// supabase/functions/test-scraping/index.ts
// Endpoint de testing: permite llamar el scraping y ver resultados detallados
// sin guardar en BD. Útil para debugging.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Importar helpers
import {
  extractJsonLd,
  extractMetaTags,
  detectTipo,
  detectModalidad,
  fillWithClaude,
  detectSourceFromUrl,
  normalizeHtml,
  type ScrapedFields,
  type ScrapingMetadata,
} from 'supabase/functions/_shared/scraping_helpers.ts';

interface TestRequest {
  url: string;
  fuente?: string;
  verbose?: boolean; // si true, retornar HTML snippet
}

interface TestResponse {
  success: boolean;
  url: string;
  detected_fuente: string;
  timing: {
    fetch_ms: number;
    tier1_ms: number;
    tier2_ms: number;
    tier3_ms: number;
    total_ms: number;
  };
  extraction: {
    tier1: Record<string, unknown> | null;
    tier2: Record<string, unknown> | null;
    tier3_used: boolean;
    tier3_fields: string[];
  };
  final_data: ScrapedFields;
  metadata: ScrapingMetadata;
  html_size_kb: number;
  http_status: number;
  error?: string;
  html_snippet?: string; // solo si verbose=true
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'POST only' }), { status: 405 });
  }

  const body = (await req.json()) as TestRequest;
  const { url, fuente, verbose } = body;

  if (!url) {
    return new Response(
      JSON.stringify({ error: 'URL requerida' }),
      { status: 400 }
    );
  }

  let urlObj: URL;
  try {
    urlObj = new URL(url);
  } catch {
    return new Response(
      JSON.stringify({ error: 'URL inválida' }),
      { status: 400 }
    );
  }

  const startTotal = Date.now();
  let html = '';
  let htmlSize = 0;
  let httpStatus = 0;

  try {
    // ============================================================
    // FETCH
    // ============================================================
    const startFetch = Date.now();
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      signal: AbortSignal.timeout(10000),
    });

    httpStatus = response.status;
    const fetchMs = Date.now() - startFetch;

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    html = await response.text();
    htmlSize = new TextEncoder().encode(html).length / 1024;
    html = normalizeHtml(html);

    // ============================================================
    // EXTRACTION TIERS
    // ============================================================

    // Tier 1: JSON-LD
    const startTier1 = Date.now();
    const tier1Data = extractJsonLd(html);
    const tier1Ms = Date.now() - startTier1;

    // Tier 2: Meta Tags
    const startTier2 = Date.now();
    const tier2Data = extractMetaTags(html);
    const tier2Ms = Date.now() - startTier2;

    // Merge de datos
    let fields: Partial<ScrapedFields> = { ...tier1Data, ...tier2Data };

    // Tier 3: Claude
    const needsClaude = !fields.puesto || !fields.empresa || !fields.requisitos;
    let tier3Used = false;
    let tier3Fields: string[] = [];

    const startTier3 = Date.now();
    let tier3Ms = 0;

    if (needsClaude) {
      const { filled, fieldsAdded } = await fillWithClaude(fields, url, html);
      fields = filled;
      tier3Used = true;
      tier3Fields = fieldsAdded;
      tier3Ms = Date.now() - startTier3;
    }

    // ============================================================
    // INFERIR TIPO Y MODALIDAD
    // ============================================================

    const client = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const detectedFuente = fuente || detectSourceFromUrl(url) || 'otros';

    const { data: configData } = await client
      .from('SCRAPING_CONFIG')
      .select('junior_regex')
      .eq('fuente', detectedFuente)
      .single();

    const juniorRegex = configData?.junior_regex;

    if (!fields.tipo) {
      fields.tipo = detectTipo(fields, juniorRegex) || null;
    }

    if (!fields.modalidad && fields.requisitos) {
      fields.modalidad = detectModalidad(fields.requisitos) || null;
    }

    const totalMs = Date.now() - startTotal;

    // ============================================================
    // RESPUESTA DE TESTING
    // ============================================================

    const response_data: TestResponse = {
      success: true,
      url,
      detected_fuente: detectedFuente,
      timing: {
        fetch_ms: fetchMs,
        tier1_ms: tier1Ms,
        tier2_ms: tier2Ms,
        tier3_ms: tier3Ms,
        total_ms: totalMs,
      },
      extraction: {
        tier1: Object.keys(tier1Data).length > 0 ? tier1Data : null,
        tier2: Object.keys(tier2Data).length > 0 ? tier2Data : null,
        tier3_used: tier3Used,
        tier3_fields: tier3Fields,
      },
      final_data: fields,
      metadata: {
        source_json_ld: Object.keys(tier1Data).length > 0,
        source_meta_tags: Object.keys(tier2Data).length > 0,
        source_claude: tier3Fields,
        extraction_duration_ms: totalMs,
        html_size_kb: htmlSize,
      },
      html_size_kb: htmlSize,
      http_status: httpStatus,
      ...(verbose && { html_snippet: html.slice(0, 2000) }),
    };

    return new Response(JSON.stringify(response_data), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const totalMs = Date.now() - startTotal;
    const errorMsg = err instanceof Error ? err.message : String(err);

    return new Response(
      JSON.stringify({
        success: false,
        url,
        error: errorMsg,
        http_status: httpStatus,
        timing: { total_ms: totalMs },
      } as Partial<TestResponse>),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
});