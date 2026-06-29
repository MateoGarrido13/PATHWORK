import { useState } from 'react';
import { supabase } from '@/lib/supabase';

interface TestResult {
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
  final_data: Record<string, unknown>;
  metadata: Record<string, unknown>;
  html_size_kb: number;
  http_status: number;
  error?: string;
}

export function ScrapingTestPanel() {
  const [url, setUrl] = useState('');
  const [verbose, setVerbose] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'test' | 'logs'>('test');

  const FUNCTION_URL = import.meta.env.VITE_SUPABASE_FUNCTION_URL || '';

  const handleTest = async () => {
    if (!url.trim()) {
      setError('Ingresá una URL');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch(`${FUNCTION_URL}/test-scraping`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, verbose }),
      });

      const json = (await response.json()) as TestResult;

      if (!json.success) {
        setError(json.error || 'Error desconocido');
      } else {
        setResult(json);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4 bg-gray-50 rounded-lg border">
      <h2 className="text-2xl font-bold mb-4">🔬 Testing de Scraping</h2>

      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setTab('test')}
          className={`px-4 py-2 rounded ${
            tab === 'test'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 text-gray-700'
          }`}
        >
          Test
        </button>
        <button
          onClick={() => setTab('logs')}
          className={`px-4 py-2 rounded ${
            tab === 'logs'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 text-gray-700'
          }`}
        >
          Logs
        </button>
      </div>

      {tab === 'test' && (
        <div className="space-y-4">
          <div>
            <label className="block font-semibold mb-2">URL a testear:</label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://..."
              className="w-full px-3 py-2 border rounded"
              disabled={loading}
            />
          </div>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={verbose}
              onChange={(e) => setVerbose(e.target.checked)}
              disabled={loading}
            />
            <span>Verbose (mostrar HTML)</span>
          </label>

          <button
            onClick={handleTest}
            disabled={loading}
            className="w-full px-4 py-3 bg-blue-600 text-white rounded font-semibold disabled:bg-gray-400"
          >
            {loading ? 'Testeando...' : 'Testear Scraping'}
          </button>

          {error && <div className="p-3 bg-red-100 text-red-700 rounded">{error}</div>}

          {result && (
            <div className="space-y-4 bg-white p-4 rounded border">
              {/* Resumen */}
              <div>
                <h3 className="font-bold text-lg mb-2">✅ Resultado</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-semibold">Fuente detectada:</span>
                    <p className="text-gray-700">{result.detected_fuente}</p>
                  </div>
                  <div>
                    <span className="font-semibold">HTTP Status:</span>
                    <p className="text-gray-700">{result.http_status}</p>
                  </div>
                  <div>
                    <span className="font-semibold">Tamaño HTML:</span>
                    <p className="text-gray-700">{result.html_size_kb.toFixed(2)} KB</p>
                  </div>
                  <div>
                    <span className="font-semibold">Tiempo total:</span>
                    <p className="text-gray-700">{result.timing.total_ms}ms</p>
                  </div>
                </div>
              </div>

              {/* Timing Breakdown */}
              <div>
                <h3 className="font-bold mb-2">⏱️ Timing</h3>
                <div className="space-y-1 text-sm font-mono bg-gray-100 p-3 rounded">
                  <p>Fetch:     {result.timing.fetch_ms.padStart(5)}ms</p>
                  <p>Tier 1:    {result.timing.tier1_ms.padStart(5)}ms (JSON-LD)</p>
                  <p>Tier 2:    {result.timing.tier2_ms.padStart(5)}ms (Meta tags)</p>
                  <p>Tier 3:    {result.timing.tier3_ms.padStart(5)}ms (Claude)</p>
                  <p className="border-t border-gray-300 pt-1">
                    <span className="font-bold">Total:    {result.timing.total_ms.padStart(5)}ms</span>
                  </p>
                </div>
              </div>

              {/* Extraction Breakdown */}
              <div>
                <h3 className="font-bold mb-2">🔍 Extracción por Tier</h3>
                <div className="space-y-2 text-sm">
                  <div className="p-2 bg-blue-50 rounded">
                    <p className="font-semibold text-blue-900">Tier 1 (JSON-LD)</p>
                    {result.extraction.tier1 ? (
                      <pre className="text-xs overflow-auto max-h-40 bg-white p-2 rounded mt-1">
                        {JSON.stringify(result.extraction.tier1, null, 2)}
                      </pre>
                    ) : (
                      <p className="text-gray-500">No encontrado</p>
                    )}
                  </div>

                  <div className="p-2 bg-green-50 rounded">
                    <p className="font-semibold text-green-900">Tier 2 (Meta Tags)</p>
                    {result.extraction.tier2 ? (
                      <pre className="text-xs overflow-auto max-h-40 bg-white p-2 rounded mt-1">
                        {JSON.stringify(result.extraction.tier2, null, 2)}
                      </pre>
                    ) : (
                      <p className="text-gray-500">No encontrado</p>
                    )}
                  </div>

                  <div className="p-2 bg-purple-50 rounded">
                    <p className="font-semibold text-purple-900">
                      Tier 3 (Claude) {result.extraction.tier3_used ? '✓' : '✗'}
                    </p>
                    {result.extraction.tier3_used ? (
                      <p className="text-sm text-purple-700 mt-1">
                        Campos rellenados: {result.extraction.tier3_fields.join(', ')}
                      </p>
                    ) : (
                      <p className="text-gray-500">No fue necesario</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Datos Finales */}
              <div>
                <h3 className="font-bold mb-2">📋 Datos Finales</h3>
                <pre className="bg-gray-100 p-3 rounded text-xs overflow-auto max-h-60">
                  {JSON.stringify(result.final_data, null, 2)}
                </pre>
              </div>

              {/* HTML Snippet (si verbose) */}
              {result.metadata?.html_size_kb && (
                <div className="text-xs text-gray-500">
                  💡 Verbose mode deshabilitado (activar si necesitás ver HTML)
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {tab === 'logs' && <LogsTab />}
    </div>
  );
}

// ============================================================
// TAB DE LOGS
// ============================================================

function LogsTab() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('LOG_SCRAPING')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      setLogs(data || []);
    } catch (err) {
      alert(`Error: ${err instanceof Error ? err.message : 'desconocido'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <button
        onClick={loadLogs}
        disabled={loading}
        className="w-full px-4 py-2 bg-blue-600 text-white rounded disabled:bg-gray-400"
      >
        {loading ? 'Cargando...' : 'Cargar Logs'}
      </button>

      <div className="space-y-2">
        {logs.length === 0 ? (
          <p className="text-gray-500">No hay logs. Cargá para ver.</p>
        ) : (
          logs.map((log) => (
            <div key={log.id} className="p-3 bg-white border rounded text-sm">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className="font-semibold">{log.fuente.toUpperCase()}</p>
                  <p className="text-gray-600 text-xs truncate">{log.url}</p>
                </div>
                <span
                  className={`px-2 py-1 rounded text-xs font-bold ${
                    log.status === 'success'
                      ? 'bg-green-100 text-green-800'
                      : log.status === 'partial'
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-red-100 text-red-800'
                  }`}
                >
                  {log.status}
                </span>
              </div>
              <div className="text-xs text-gray-500 space-y-1">
                <p>⏱️ {log.duration_ms}ms</p>
                {log.error_message && <p className="text-red-600">❌ {log.error_message}</p>}
                {log.metadata?.source_claude?.length > 0 && (
                  <p>📌 Claude completó: {log.metadata.source_claude.join(', ')}</p>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}