import { useState } from 'react';
import { useScrapeJob } from '@/hooks/useScrapeJob';
import { supabase } from '@/lib/supabase';

type Fuente = 'computrabajo' | 'bumeran' | 'zonajobs' | 'getonboard' | 'indeed' | 'otros';
type Tipo = 'pasantia' | 'jovenes_profesionales' | 'junior';
type Modalidad = 'remoto' | 'hibrido' | 'presencial';

interface FormState {
  url: string;
  fuente: Fuente;
  empresa: string;
  puesto: string;
  requisitos: string;
  modalidad: Modalidad | null;
  tipo: Tipo | null;
  fecha_vencimiento: string;
  comentarios: string;
}

export function NewVacanteForm() {
  const { loading: scraping, error: scrapError, data: scrapedData, scrape } = useScrapeJob();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState>({
    url: '',
    fuente: 'otros',
    empresa: '',
    puesto: '',
    requisitos: '',
    modalidad: null,
    tipo: null,
    fecha_vencimiento: '',
    comentarios: '',
  });

  const [step, setStep] = useState<'url' | 'review'>('url');

  // ============================================================
  // PASO 1: URL Input
  // ============================================================
  const handleScrapeClick = async () => {
    if (!form.url.trim()) {
      alert('Ingresá una URL');
      return;
    }
    await scrape(form.url, form.fuente);
  };

  // Al recibir datos scrapedados, actualiza el formulario
  if (scrapedData && step === 'url') {
    setForm((prev) => ({
      ...prev,
      empresa: scrapedData.empresa || '',
      puesto: scrapedData.puesto || '',
      requisitos: scrapedData.requisitos || '',
      modalidad: scrapedData.modalidad || null,
      tipo: scrapedData.tipo || null,
    }));
    setStep('review');
  }

  // ============================================================
  // PASO 2: Review y edición de campos
  // ============================================================
  const handleFieldChange = (key: keyof FormState, value: string | null) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  // Validar fecha
  const isValidDate = form.fecha_vencimiento
    ? new Date(form.fecha_vencimiento) >= new Date()
    : false;

  // ============================================================
  // GUARDAR EN BD
  // ============================================================
  const handleSave = async () => {
    // Validaciones
    if (!form.empresa || !form.puesto || !form.fecha_vencimiento) {
      alert('Empresa, puesto y fecha de vencimiento son requeridos');
      return;
    }
    if (!isValidDate) {
      alert('La fecha de vencimiento no puede ser pasada');
      return;
    }

    setSaving(true);
    try {
      // Primero, guardar o actualizar la empresa
      const { data: empresaData, error: empresaError } = await supabase
        .from('EMPRESA')
        .upsert({ name_emp: form.empresa }, { onConflict: 'name_emp' })
        .select('id_emp')
        .single();

      if (empresaError) throw empresaError;

      // Luego, guardar el puesto
      const { data: puestoData, error: puestoError } = await supabase
        .from('PUESTO')
        .upsert({ nombre_puesto: form.puesto }, { onConflict: 'nombre_puesto' })
        .select('id_puesto')
        .single();

      if (puestoError) throw puestoError;

      // Finalmente, insertar la vacante
      const { error: vacanteError } = await supabase
        .from('VACANTES')
        .insert({
          url: form.url,
          fuente: form.fuente,
          id_emp: empresaData.id_emp,
          id_puesto: puestoData.id_puesto,
          requisitos: form.requisitos,
          modalidad: form.modalidad,
          tipo: form.tipo,
          fecha_vencimiento: form.fecha_vencimiento,
          comentarios: form.comentarios,
          estado: 'pendiente',
        });

      if (vacanteError) throw vacanteError;

      alert('Vacante guardada exitosamente');
      setForm({
        url: '',
        fuente: 'otros',
        empresa: '',
        puesto: '',
        requisitos: '',
        modalidad: null,
        tipo: null,
        fecha_vencimiento: '',
        comentarios: '',
      });
      setStep('url');
    } catch (err) {
      console.error('Error guardando vacante:', err);
      alert(`Error: ${err instanceof Error ? err.message : 'desconocido'}`);
    } finally {
      setSaving(false);
    }
  };

  // ============================================================
  // RENDER
  // ============================================================
  if (step === 'url') {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-bold">Nueva Vacante</h2>

        <input
          type="url"
          placeholder="Pega el link de la vacante"
          value={form.url}
          onChange={(e) => handleFieldChange('url', e.target.value)}
          className="w-full px-3 py-2 border rounded"
          disabled={scraping}
        />

        <select
          value={form.fuente}
          onChange={(e) => handleFieldChange('fuente', e.target.value as Fuente)}
          className="w-full px-3 py-2 border rounded"
        >
          <option value="computrabajo">Computrabajo</option>
          <option value="bumeran">Bumeran</option>
          <option value="zonajobs">ZonaJobs</option>
          <option value="getonboard">GetOnBoard</option>
          <option value="indeed">Indeed</option>
          <option value="otros">Otros</option>
        </select>

        {scrapError && <p className="text-red-600">{scrapError}</p>}

        <button
          onClick={handleScrapeClick}
          disabled={scraping}
          className="w-full px-4 py-2 bg-blue-600 text-white rounded disabled:bg-gray-400"
        >
          {scraping ? 'Analizando...' : 'Analizar Vacante'}
        </button>
      </div>
    );
  }

  // Step: review
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Revisar y Editar</h2>

      <div>
        <label className="block text-sm font-semibold mb-1">Empresa *</label>
        <input
          type="text"
          value={form.empresa}
          onChange={(e) => handleFieldChange('empresa', e.target.value)}
          className="w-full px-3 py-2 border rounded"
        />
      </div>

      <div>
        <label className="block text-sm font-semibold mb-1">Puesto *</label>
        <input
          type="text"
          value={form.puesto}
          onChange={(e) => handleFieldChange('puesto', e.target.value)}
          className="w-full px-3 py-2 border rounded"
        />
      </div>

      <div>
        <label className="block text-sm font-semibold mb-1">Requisitos</label>
        <textarea
          value={form.requisitos}
          onChange={(e) => handleFieldChange('requisitos', e.target.value)}
          rows={4}
          className="w-full px-3 py-2 border rounded"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold mb-1">Modalidad</label>
          <select
            value={form.modalidad || ''}
            onChange={(e) => handleFieldChange('modalidad', e.target.value as Modalidad | '')}
            className="w-full px-3 py-2 border rounded"
          >
            <option value="">Seleccionar</option>
            <option value="remoto">Remoto</option>
            <option value="hibrido">Híbrido</option>
            <option value="presencial">Presencial</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold mb-1">Tipo</label>
          <select
            value={form.tipo || ''}
            onChange={(e) => handleFieldChange('tipo', e.target.value as Tipo | '')}
            className="w-full px-3 py-2 border rounded"
          >
            <option value="">Seleccionar</option>
            <option value="pasantia">Pasantía</option>
            <option value="jovenes_profesionales">Joven Profesional</option>
            <option value="junior">Junior</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-semibold mb-1">
          Vencimiento *{' '}
          {!isValidDate && form.fecha_vencimiento && (
            <span className="text-red-600 text-xs">Fecha pasada</span>
          )}
        </label>
        <input
          type="date"
          value={form.fecha_vencimiento}
          onChange={(e) => handleFieldChange('fecha_vencimiento', e.target.value)}
          min={new Date().toISOString().split('T')[0]}
          className="w-full px-3 py-2 border rounded"
        />
      </div>

      <div>
        <label className="block text-sm font-semibold mb-1">Comentarios</label>
        <textarea
          value={form.comentarios}
          onChange={(e) => handleFieldChange('comentarios', e.target.value)}
          rows={2}
          className="w-full px-3 py-2 border rounded"
        />
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => setStep('url')}
          disabled={saving}
          className="flex-1 px-4 py-2 border rounded disabled:bg-gray-100"
        >
          Volver
        </button>
        <button
          onClick={handleSave}
          disabled={saving || !isValidDate}
          className="flex-1 px-4 py-2 bg-green-600 text-white rounded disabled:bg-gray-400"
        >
          {saving ? 'Guardando...' : 'Guardar Vacante'}
        </button>
      </div>
    </div>
  );
}