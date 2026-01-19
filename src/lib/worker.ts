import * as cheerio from 'cheerio';
import Parser from 'rss-parser';
import { parse as parseJsonC } from 'jsonc-parser';
import { JobData, JobResult } from './queue';

const OLLAMA_ENDPOINT = process.env.OLLAMA_ENDPOINT || 'http://localhost:11434';

function normalizeUrl(url: string): string {
  if (url.startsWith('//')) {
    return 'https:' + url;
  }
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return 'https://' + url;
  }
  return url;
}

async function duckDuckGoSearch(query: string, limit: number = 50): Promise<any[]> {
  try {
    const url = `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const html = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }).then(r => r.text());
    const $ = cheerio.load(html);

    const results: any[] = [];
    $('a.result__a').each((i, el) => {
      if (results.length >= limit) return;
      const title = $(el).text();
      let href = $(el).attr('href') || '';
      href = normalizeUrl(href);
      results.push({ url: href, title, snippet: '' });
    });

    return results;
  } catch (error) {
    console.error('DuckDuckGo search error:', error);
    return [];
  }
}

async function redditSearch(query: string, limit: number = 30): Promise<any[]> {
  try {
    const url = `https://old.reddit.com/search?q=${encodeURIComponent(query)}&type=link`;
    const html = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }).then(r => r.text());
    const $ = cheerio.load(html);

    const results: any[] = [];
    $('a.search-title').each((i, el) => {
      if (results.length >= limit) return;
      const title = $(el).text();
      let href = $(el).attr('href') || '';
      href = normalizeUrl(href);
      results.push({ url: href, title, snippet: '' });
    });

    return results;
  } catch (error) {
    console.error('Reddit search error:', error);
    return [];
  }
}

async function wikiSearch(query: string, limit: number = 10): Promise<any[]> {
  try {
    const url = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&srlimit=${limit}`;
    const data = await fetch(url).then(r => r.json());
    const results: any[] = [];

    (data.query?.search || []).forEach((item: any) => {
      results.push({
        url: normalizeUrl(`https://en.wikipedia.org/wiki/${encodeURIComponent(item.title)}`),
        title: item.title,
        snippet: item.snippet
      });
    });

    return results;
  } catch (error) {
    console.error('Wikipedia search error:', error);
    return [];
  }
}

async function rssNewsSearch(query: string): Promise<any[]> {
  try {
    const parser = new Parser();
    const feeds = [
      'https://news.google.com/rss',
      'https://feeds.bloomberg.com/markets/news.rss',
      'https://feeds.cnbc.com/cnbc/world/'
    ];

    const results: any[] = [];
    for (const feedUrl of feeds) {
      try {
        const feed = await parser.parseURL(feedUrl);
        feed.items.forEach((item: any) => {
          if (item.title?.toLowerCase().includes(query.toLowerCase())) {
            results.push({
              url: normalizeUrl(item.link || ''),
              title: item.title || '',
              snippet: item.contentSnippet || ''
            });
          }
        });
      } catch (err) {
        console.error('Error parsing feed:', feedUrl, err);
      }
    }

    return results;
  } catch (error) {
    console.error('RSS search error:', error);
    return [];
  }
}

async function scrapeContent(url: string): Promise<string> {
  try {
    const normalizedUrl = normalizeUrl(url);
    const html = await fetch(normalizedUrl, { 
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(5000)
    }).then(r => r.text());
    const $ = cheerio.load(html);
    $('script, style, nav, footer').remove();
    const text = $('body').text();
    return text.replace(/\s+/g, ' ').trim().slice(0, 5000);
  } catch (error) {
    console.error('Scrape error for', url, error);
    return '';
  }
}

function chunkText(text: string, chunkSize: number = 2000): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += chunkSize) {
    chunks.push(text.slice(i, i + chunkSize));
  }
  return chunks;
}

async function analyzeWithOllama(prompt: string): Promise<string> {
  try {
    const response = await fetch(`${OLLAMA_ENDPOINT}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama3',
        prompt,
        stream: false,
      }),
      signal: AbortSignal.timeout(300000)
    });

    if (!response.ok) {
      console.error('Ollama API error:', response.status, response.statusText);
      return '';
    }

    const data = await response.json() as any;
    return data.response || '';
  } catch (error) {
    console.error('Ollama analysis error:', error);
    return '';
  }
}

export async function processResearchJob(jobId: string, input: JobData, onProgress: (progress: number) => void): Promise<JobResult> {
  const keyword = input.keyword;
  const location = input.location || 'Azerbaijan';

  try {
    onProgress(5);

    // Search phase
    const [ddg, reddit, wiki, rss] = await Promise.all([
      duckDuckGoSearch(keyword, 80),
      redditSearch(keyword, 40),
      wikiSearch(keyword, 15),
      rssNewsSearch(keyword)
    ]);

    onProgress(25);

    // Deduplicate results
    const all = [...ddg, ...reddit, ...wiki, ...rss];
    const unique = Array.from(new Map(all.map(r => [r.url, r])).values()).slice(0, 50);

    onProgress(35);

    // Scrape content
    const scraped = [];
    for (let i = 0; i < unique.length; i++) {
      const r = unique[i];
      const content = await scrapeContent(r.url);
      if (content.length > 200) {
        scraped.push({ ...r, content });
      }
      // Update progress during scraping
      if (unique.length > 0) {
        onProgress(35 + ((i + 1) / unique.length) * 25);
      }
    }

    onProgress(60);

    // Combine and chunk content
    const combined = scraped.map(r => r.content).join('\n\n');
    const chunks = chunkText(combined, 2000).slice(0, 5);

    onProgress(70);

    // Analyze with Ollama
    const analysisPrompt = `You are a senior business analyst. Your task is to generate ONE real business idea based on the keyword, location, and budget.

You MUST output ONLY valid JSON. No explanations. No extra text.

If the keyword is too broad, you must still create ONE real business idea.

Return JSON in this exact format:

{
  "problem": "Explain the real pain/problem in 2-3 sentences",
  "target_users": "Who will pay for it",
  "why_it_matters": "Why solving this problem matters",
  "existing_bad_solutions": "What people currently do",
  "mvp_idea": "Your ONE MVP idea (what you will build first)",
  "why_it_can_work_in_location": "Why this can work in the given location",
  "estimated_budget_range": "Budget needed (low to high)",
  "revenue_model": "How it will make money",
  "first_3_steps": ["step1", "step2", "step3"]
}

KEYWORD: ${keyword}
LOCATION: ${location}
BUDGET: ${input.budget}

Use the data below ONLY as supporting evidence:

${chunks.join("\n\n")}

IMPORTANT:
- Do not explain what a game is.
- Do not write definitions.
- Do not write anything unrelated to a business idea.
- Output must be valid JSON only.`;

    const analysis = await analyzeWithOllama(analysisPrompt);

    onProgress(85);

    // Parse response
    let result: JobResult;
    try {
      // Try to extract JSON from the response (handle code blocks, markdown, etc.)
      let jsonText = '';
      
      // First, try to extract from code blocks (```json ... ``` or ``` ... ```)
      const codeBlockMatch = analysis.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
      if (codeBlockMatch) {
        jsonText = codeBlockMatch[1];
      } else {
        // Try to find JSON object
        const jsonMatch = analysis.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          jsonText = jsonMatch[0];
        }
      }

      let parsed: any = null;

      if (jsonText) {
        // Fix common JSON mistakes (be careful not to break valid JSON)
        let cleanedJson = jsonText.trim();
        
        // Remove markdown formatting if any
        cleanedJson = cleanedJson.replace(/^```json\s*/i, '').replace(/```\s*$/, '');
        
        // Remove trailing commas before } or ]
        cleanedJson = cleanedJson.replace(/,(\s*[}\]])/g, '$1');
        
        // Try parsing as-is first (might already be valid)
        try {
          parsed = parseJsonC(cleanedJson);
        } catch (e1) {
          // If that fails, try more aggressive cleanup
          try {
            // Handle unquoted keys (but only if they're not already quoted)
            // This is tricky - we need to avoid breaking string values
            let fixedJson = cleanedJson;
            
            // Replace single quotes with double quotes (simple approach - replace all single quotes)
            // This might break some edge cases but handles the common case
            fixedJson = fixedJson.replace(/'/g, '"');
            
            // Try to fix unquoted keys: match "key:" where key is alphanumeric and not in quotes
            // This is a simple heuristic - match word: that's not inside quotes
            fixedJson = fixedJson.replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');
            
            parsed = parseJsonC(fixedJson);
          } catch (e2) {
            // Last attempt: try native JSON.parse with even more aggressive cleanup
            try {
              // Remove any text before first { and after last }
              const firstBrace = cleanedJson.indexOf('{');
              const lastBrace = cleanedJson.lastIndexOf('}');
              if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
                let extracted = cleanedJson.substring(firstBrace, lastBrace + 1);
                // Remove trailing commas
                extracted = extracted.replace(/,(\s*[}\]])/g, '$1');
                // Try native JSON.parse
                parsed = JSON.parse(extracted);
              }
            } catch (e3) {
              console.error('All JSON parsing attempts failed. Raw response preview:', analysis.substring(0, 500));
              parsed = null;
            }
          }
        }
      }

      if (!parsed) {
        console.warn('AI response was not valid JSON. Returning empty defaults.');
        parsed = {
          problem: '',
          target_users: '',
          why_it_matters: '',
          existing_bad_solutions: '',
          mvp_idea: '',
          why_it_can_work_in_location: '',
          estimated_budget_range: '',
          revenue_model: '',
          first_3_steps: []
        };
      }

      result = {
        problem: parsed?.problem || '',
        target_users: parsed?.target_users || '',
        why_it_matters: parsed?.why_it_matters || '',
        existing_bad_solutions: parsed?.existing_bad_solutions || '',
        mvp_idea: parsed?.mvp_idea || '',
        why_it_can_work_in_location: parsed?.why_it_can_work_in_location || '',
        estimated_budget_range: parsed?.estimated_budget_range || '',
        revenue_model: parsed?.revenue_model || '',
        first_3_steps: Array.isArray(parsed?.first_3_steps) ? parsed.first_3_steps : []
      };
    } catch (err) {
      console.error('Error parsing analysis JSON:', err);
      result = {
        problem: '',
        target_users: '',
        why_it_matters: '',
        existing_bad_solutions: '',
        mvp_idea: '',
        why_it_can_work_in_location: '',
        estimated_budget_range: '',
        revenue_model: '',
        first_3_steps: []
      };
    }

    onProgress(100);
    return result;
  } catch (error) {
    console.error('Error processing research job:', error);
    throw error;
  }
}
