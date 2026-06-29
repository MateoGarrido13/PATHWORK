// supabase/functions/scrape-job/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Importar helpers desde _shared
import {
  ScrapedFields,
  ScrapingMetadata,
  extractJsonLd,
  extractMetaTags,
  detectTipo,
  detectModalidad,
  fillWithClaude,
  detectSourceFromUrl,
  normalizeHtml,
} from '../_shared/scraping_helpers.ts';

// ============================================================
// TIPOS
// ============================================================

interface ScrapJobRequest {
  url: string;
  fuente?: string;
  vacante_id?: string; // si ya existe un registro, actualizar log
}

interface ScrapJobResponse {
  success: boolean;
  data?: ScrapedFields;
  error?: string;
  metadata?: ScrapingMetadata;
  log_id?: string;
}

// ============================================================
// MAIN
// ============================================================

Deno.serve(async (req: Request) => {
  // Solo POST
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
    });
  }

  const body = (await req.json()) as ScrapJobRequest;
  const { url, fuente, vacante_id } = body;

  if (!url) {
    return new Response(
      JSON.stringify({
        success: false,
        error: 'URL es requerida',
      } as ScrapJobResponse),
      { status: 400 }
    );
  }

  // Validar URL
  let urlObj: URL;
  try {
    urlObj = new URL(url);
  } catch {
    return new Response(
      JSON.stringify({
        success: false,
        error: 'URL inválida',
      } as ScrapJobResponse),
      { status: 400 }
    );
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get(
    'SUPABASE_SERVICE_ROLE_KEY'
  );

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    const missing = [] as string[];
    if (!SUPABASE_URL) missing.push('SUPABASE_URL');
    if (!SUPABASE_SERVICE_ROLE_KEY) missing.push('SUPABASE_SERVICE_ROLE_KEY');
    const message = `Faltan variables de entorno: ${missing.join(', ')}`;
    console.error('[ENV]', message);
    return new Response(
      JSON.stringify({ success: false, error: message } as ScrapJobResponse),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const client = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const startTime = Date.now();
  let html = '';
  let htmlSize = 0;
  let detectedFuente = fuente;

  try {
    // ============================================================
    // PASO 1: FETCH HTML
    // ============================================================
    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      signal: AbortSignal.timeout(10000), // 10 segundos timeout
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    html = await response.text();
    htmlSize = new TextEncoder().encode(html).length / 1024; // KB

    // Normalizar para evitar errores de encoding
    html = normalizeHtml(html);

    // Si no se especificó fuente, detectar desde URL
    if (!detectedFuente) {
      detectedFuente = detectSourceFromUrl(url) || 'otros';
    }

    // ============================================================
    // PASO 2: EXTRAER DATOS (3 TIERS)
    // ============================================================

    let fields: Partial<ScrapedFields> = {};
    const metadata: ScrapingMetadata = {
      source_json_ld: false,
      source_meta_tags: false,
      source_claude: [],
      extraction_duration_ms: 0,
      html_size_kb: htmlSize,
    };

    // Tier 1: JSON-LD
    const jsonLdFields = extractJsonLd(html);
    if (Object.keys(jsonLdFields).length > 0) {
      fields = { ...fields, ...jsonLdFields };
      metadata.source_json_ld = true;
      console.log('[Tier 1] JSON-LD extraído:', jsonLdFields);
    }

    // Tier 2: Meta Tags
    const metaFields = extractMetaTags(html);
    if (Object.keys(metaFields).length > 0) {
      fields = { ...fields, ...metaFields };
      metadata.source_meta_tags = true;
      console.log('[Tier 2] Meta tags extraídos:', metaFields);
    }

    // Tier 3: Claude (si faltan campos críticos)
    const needsClaude =
      !fields.puesto || !fields.empresa || !fields.requisitos;

    if (needsClaude) {
      console.log('[Tier 3] Invocando Claude para rellenar gaps...');
      const { filled, fieldsAdded } = await fillWithClaude(fields, url, html);
      fields = filled;
      metadata.source_claude = fieldsAdded;
    }

    // ============================================================
    // PASO 3: INFERIR TIPO Y MODALIDAD
    // ============================================================

    // Obtener regex de config si está disponible
    const { data: configData } = await client
      .from('SCRAPING_CONFIG')
      .select('junior_regex')
      .eq('fuente', detectedFuente || 'otros')
      .single();

    const juniorRegex = configData?.junior_regex;

    // Detectar tipo
    if (!fields.tipo) {
      fields.tipo = detectTipo(fields, juniorRegex) || null;
    }

    // Detectar modalidad (fallback)
    if (!fields.modalidad && fields.requisitos) {
      fields.modalidad = detectModalidad(fields.requisitos) || null;
    }

    const duration = Date.now() - startTime;
    metadata.extraction_duration_ms = duration;

    // ============================================================
    // PASO 4: REGISTRAR EN LOG_SCRAPING
    // ============================================================

    const status = needsClaude ? 'partial' : 'success';

    const logResponse = await client
      .from('LOG_SCRAPING')
      .insert({
        id_vacante: vacante_id || null,
        fuente: detectedFuente,
        url,
        status,
        metadata,
        error_message: null,
        duration_ms: duration,
      })
      .select('id')
      .single();

    // ============================================================
    // RESPUESTA
    // ============================================================

    return new Response(
      JSON.stringify({
        success: true,
        data: fields,
        metadata,
        log_id: logResponse.data?.id,
      } as ScrapJobResponse),
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (err) {
    const duration = Date.now() - startTime;
    const errorMsg = err instanceof Error ? err.message : String(err);

    // Registrar el error en LOG_SCRAPING
    try {
      await client.from('LOG_SCRAPING').insert({
        id_vacante: vacante_id || null,
        fuente: detectedFuente,
        url,
        status: 'failed',
        error_message: errorMsg,
        duration_ms: duration,
        metadata: {
          html_size_kb: htmlSize,
          extraction_duration_ms: duration,
          source_json_ld: false,
          source_meta_tags: false,
          source_claude: [],
        },
      });
    } catch (logErr) {
      console.error('[LOG] Error registrando falla:', logErr);
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: errorMsg,
      } as ScrapJobResponse),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
});
