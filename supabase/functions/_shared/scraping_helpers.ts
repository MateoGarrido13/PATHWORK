// ============================================================
// HELPERS COMPARTIDOS PARA SCRAPING
// ============================================================

export interface ScrapedFields {
  empresa?: string;
  puesto?: string;
  requisitos?: string;
  modalidad?: 'remoto' | 'hibrido' | 'presencial' | null;
  tipo?: 'pasantia' | 'jovenes_profesionales' | 'junior' | null;
}

export interface ScrapingMetadata {
  source_json_ld: boolean;
  source_meta_tags: boolean;
  source_claude: string[]; // campos rellenados por Claude
  extraction_duration_ms: number;
  html_size_kb: number;
}

// ============================================================
// 1. EXTRAER JSON-LD (schema.org/JobPosting)
// ============================================================
export function extractJsonLd(html: string): Partial<ScrapedFields> {
  const result: Partial<ScrapedFields> = {};

  try {
    const jsonLdRegex = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/i;
    const match = html.match(jsonLdRegex);

    if (!match) return result;

    const jsonLdArray = JSON.parse(match[1]);
    const jobPosting = Array.isArray(jsonLdArray)
      ? jsonLdArray.find((item) => item['@type'] === 'JobPosting' || item['@type']?.includes('JobPosting'))
      : jsonLdArray['@type']?.includes('JobPosting')
      ? jsonLdArray
      : null;

    if (!jobPosting) return result;

    // Extractores específicos por portal (algunas inconsistencias menores)
    result.puesto = jobPosting.title || jobPosting.jobTitle;
    result.empresa = jobPosting.hiringOrganization?.name || jobPosting.companyName;
    result.requisitos = jobPosting.description;

    // Modalidad (jobLocationType en schema.org)
    if (jobPosting.jobLocationType) {
      const locType = jobPosting.jobLocationType.toLowerCase();
      if (locType.includes('remote')) result.modalidad = 'remoto';
      else if (locType.includes('hybrid')) result.modalidad = 'hibrido';
      else if (locType.includes('on-site') || locType.includes('on site'))
        result.modalidad = 'presencial';
    }
  } catch (err) {
    console.error('[JSON-LD] Parse error:', err);
  }

  return result;
}

// ============================================================
// 2. EXTRAER META TAGS (fallback de JSON-LD)
// ============================================================
export function extractMetaTags(html: string): Partial<ScrapedFields> {
  const result: Partial<ScrapedFields> = {};

  try {
    // og:title generalmente tiene el puesto
    const titleMatch = html.match(/<meta\s+property="og:title"\s+content="([^"]*)"/i);
    if (titleMatch) result.puesto = titleMatch[1];

    // og:description a veces tiene requisitos o una descripción corta
    const descMatch = html.match(/<meta\s+property="og:description"\s+content="([^"]*)"/i);
    if (descMatch) {
      const desc = descMatch[1];
      // Si el description parece corto, probablemente sea resumen, no requisitos
      if (desc.length > 200) result.requisitos = desc;
    }

    // Algunos portales meten la empresa en el sitename
    const siteMatch = html.match(/<meta\s+property="og:site_name"\s+content="([^"]*)"/i);
    if (siteMatch && !result.empresa) {
      const site = siteMatch[1];
      // No confundir el nombre del portal con la empresa
      if (!['LinkedIn', 'Indeed', 'Computrabajo', 'Bumeran'].includes(site)) {
        result.empresa = site;
      }
    }
  } catch (err) {
    console.error('[Meta Tags] Parse error:', err);
  }

  return result;
}

// ============================================================
// 3. DETECTAR TIPO (usando regex)
// ============================================================
export function detectTipo(
  fields: Partial<ScrapedFields>,
  juniorRegex?: string | null
): 'pasantia' | 'jovenes_profesionales' | 'junior' | null {
  const text = `${fields.puesto || ''} ${fields.requisitos || ''}`.toLowerCase();

  // Prioridad 1: pasantía explícita
  if (/pasant[aí]/.test(text)) return 'pasantia';

  // Prioridad 2: joven profesional
  if (/(joven\s+profesional|profesional\s+joven|jp)/.test(text)) return 'jovenes_profesionales';

  // Prioridad 3: junior (usando regex de config o fallback)
  const regex = juniorRegex || '(junior|jr|trainee|entry.level)';
  if (new RegExp(regex, 'i').test(text)) return 'junior';

  return null;
}

// ============================================================
// 4. DETECTAR MODALIDAD (fallback de JSON-LD)
// ============================================================
export function detectModalidad(text: string): 'remoto' | 'hibrido' | 'presencial' | null {
  const lower = text.toLowerCase();
  if (/remote|remoto|teletrabajo|trabajo remoto/.test(lower)) return 'remoto';
  if (/hybrid|híbrido|hibrido/.test(lower)) return 'hibrido';
  if (/on[\s-]?site|presencial|oficina|en sitio|en línea/.test(lower)) return 'presencial';
  return null;
}

// ============================================================
// 5. LLAMAR A CLAUDE PARA RELLENAR GAPS
// ============================================================
export async function fillWithClaude(
  fields: Partial<ScrapedFields>,
  url: string,
  htmlSnippet: string
): Promise<{ filled: Partial<ScrapedFields>; fieldsAdded: string[] }> {
  const fieldsAdded: string[] = [];

  // Si ya tenemos los campos críticos, no consultamos Claude
  if (fields.puesto && fields.empresa && fields.requisitos) {
    return { filled: fields, fieldsAdded };
  }

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) {
    console.warn('[Claude] ANTHROPIC_API_KEY no configurada');
    return { filled: fields, fieldsAdded };
  }

  const prompt = `
Eres un asistente que extrae información de ofertas de empleo.
Analiza el siguiente HTML de una vacante y extrae:
- empresa (nombre de la empresa que publica la vacante)
- puesto (título del puesto)
- requisitos (lista de habilidades/requisitos solicitados)
- modalidad (remoto, híbrido o presencial)
- tipo (pasantía, joven profesional o junior)

URL: ${url}

HTML de la oferta:
\`\`\`html
${htmlSnippet.slice(0, 3000)}
\`\`\`

Campos ya extraídos:
${JSON.stringify(fields, null, 2)}

Responde SOLO en JSON válido, sin markdown. Si no puedes determinar un campo, úsalo omitido en el JSON.
{
  "empresa": "...",
  "puesto": "...",
  "requisitos": "...",
  "modalidad": "...",
  "tipo": "..."
}
`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-6',
        max_tokens: 500,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      throw new Error(`Claude API error: ${response.status}`);
    }

    const data = (await response.json()) as { content: Array<{ type: string; text: string }> };
    const textContent = data.content.find((c) => c.type === 'text')?.text;

    if (!textContent) return { filled: fields, fieldsAdded };

    // Limpiar markdown si viene envuelto
    const cleanedText = textContent.replace(/```json\n?|```\n?/g, '').trim();
    const claudeData = JSON.parse(cleanedText) as Partial<ScrapedFields>;

    // Merging: Claude rellena solo lo que falta
    const filled: Partial<ScrapedFields> = { ...fields };
    (Object.keys(claudeData) as Array<keyof ScrapedFields>).forEach((key) => {
      if (!fields[key] && claudeData[key]) {
        filled[key] = claudeData[key];
        fieldsAdded.push(key);
      }
    });

    return { filled, fieldsAdded };
  } catch (err) {
    console.error('[Claude] Error:', err);
    return { filled: fields, fieldsAdded };
  }
}

// ============================================================
// 6. DETECTAR FUENTE DESDE URL
// ============================================================
export function detectSourceFromUrl(url: string): string | null {
  const domain = new URL(url).hostname.toLowerCase();
  
  if (domain.includes('computrabajo')) return 'computrabajo';
  if (domain.includes('bumeran')) return 'bumeran';
  if (domain.includes('zonajobs')) return 'zonajobs';
  if (domain.includes('getonboard') || domain.includes('getonbrd')) return 'getonboard';
  if (domain.includes('indeed')) return 'indeed';
  
  return null;
}

// ============================================================
// 7. LIMPIAR Y NORMALIZAR HTML (para evitar errores de encoding)
// ============================================================
export function normalizeHtml(html: string): string {
  return html
    .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '') // quitar control chars
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'");
}
