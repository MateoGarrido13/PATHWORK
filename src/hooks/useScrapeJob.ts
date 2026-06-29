import { useState } from 'react';

interface ScrapedData {
  empresa?: string;
  puesto?: string;
  requisitos?: string;
  modalidad?: 'remoto' | 'hibrido' | 'presencial' | null;
  tipo?: 'pasantia' | 'jovenes_profesionales' | 'junior' | null;
}

interface UseScrapJobReturn {
  loading: boolean;
  error: string | null;
  data: ScrapedData | null;
  scrape: (url: string, fuente?: string) => Promise<void>;
  reset: () => void;
}

export function useScrapeJob(): UseScrapJobReturn {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ScrapedData | null>(null);

  const FUNCTION_URL = import.meta.env.VITE_SUPABASE_FUNCTION_URL || 'https://cjcyulvgxrzgglxwfvcd.supabase.co/functions/v1/scrape-job';

  const scrape = async (url: string, fuente?: string): Promise<void> => {
    setLoading(true);
    setError(null);
    setData(null);

    try {
      const response = await fetch(`${FUNCTION_URL}/scrape-job`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, fuente }),
      });

      const json = await response.json();

      if (!json.success) {
        throw new Error(json.error || 'Error en scraping');
      }

      setData(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setLoading(false);
    setError(null);
    setData(null);
  };

  return { loading, error, data, scrape, reset };
}