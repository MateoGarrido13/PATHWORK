#!/bin/bash

# ============================================================
# TEST SCRAPING — Script para testear Edge Function
# ============================================================

# Configuración
SUPABASE_URL="https://cjcyulvgxrzgglxwfvcd.supabase.co"  # ← REEMPLAZAR
FUNCTION_URL="${SUPABASE_URL}/functions/v1/test-scraping"

# Colores para output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# ============================================================
# FUNCIONES
# ============================================================

print_header() {
  echo -e "${BLUE}=== $1 ===${NC}"
}

print_success() {
  echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
  echo -e "${RED}✗ $1${NC}"
}

print_info() {
  echo -e "${YELLOW}ℹ $1${NC}"
}

# ============================================================
# TEST: Computrabajo (caso exitoso esperado)
# ============================================================

test_computrabajo() {
  print_header "TEST 1: Computrabajo (JSON-LD)"

  URL="https://www.computrabajo.com.ar/busquedas/Python-Developer-Buenos-Aires"
  
  echo "URL: $URL"
  echo ""

  RESPONSE=$(curl -s -X POST "$FUNCTION_URL" \
    -H "Content-Type: application/json" \
    -d "{\"url\": \"$URL\", \"verbose\": false}")

  # Extraer datos con jq
  SUCCESS=$(echo "$RESPONSE" | jq -r '.success')
  FUENTE=$(echo "$RESPONSE" | jq -r '.detected_fuente')
  TOTAL_MS=$(echo "$RESPONSE" | jq -r '.timing.total_ms')
  TIER1=$(echo "$RESPONSE" | jq -r '.extraction.tier1 | if . then "YES" else "NO" end')
  TIER3=$(echo "$RESPONSE" | jq -r '.extraction.tier3_used')

  if [ "$SUCCESS" = "true" ]; then
    print_success "Scraping completado"
    echo "Fuente detectada: $FUENTE"
    echo "Tiempo total: ${TOTAL_MS}ms"
    echo "JSON-LD encontrado: $TIER1"
    echo "Claude usado: $TIER3"
    echo ""
    echo "Datos extraídos:"
    echo "$RESPONSE" | jq '.final_data'
  else
    print_error "Error en scraping"
    echo "$RESPONSE" | jq '.error'
  fi

  echo ""
}

# ============================================================
# TEST: URL inválida (error esperado)
# ============================================================

test_invalid_url() {
  print_header "TEST 2: URL inválida (error esperado)"

  URL="not-a-valid-url"
  
  echo "URL: $URL"
  echo ""

  RESPONSE=$(curl -s -X POST "$FUNCTION_URL" \
    -H "Content-Type: application/json" \
    -d "{\"url\": \"$URL\"}")

  ERROR=$(echo "$RESPONSE" | jq -r '.error')
  
  if [ "$ERROR" != "null" ]; then
    print_success "Error capturado correctamente"
    echo "Error: $ERROR"
  else
    print_error "Debería haber fallado"
  fi

  echo ""
}

# ============================================================
# TEST: Portal que requiere Claude (sitio desconocido)
# ============================================================

test_claude_fallback() {
  print_header "TEST 3: Claude Fallback (portal desconocido)"

  URL="https://ejemplo.com/vacante-test"
  
  echo "URL: $URL"
  echo ""

  RESPONSE=$(curl -s -X POST "$FUNCTION_URL" \
    -H "Content-Type: application/json" \
    -d "{\"url\": \"$URL\"}")

  # Puede fallar por HTTP, pero si funciona, veremos si Claude fue usado
  SUCCESS=$(echo "$RESPONSE" | jq -r '.success')
  
  if [ "$SUCCESS" = "true" ]; then
    CLAUDE_USED=$(echo "$RESPONSE" | jq -r '.extraction.tier3_used')
    CLAUDE_FIELDS=$(echo "$RESPONSE" | jq -r '.extraction.tier3_fields')
    
    print_success "Scraping completado"
    echo "Claude usado: $CLAUDE_USED"
    echo "Campos rellenados por Claude: $CLAUDE_FIELDS"
  else
    ERROR=$(echo "$RESPONSE" | jq -r '.error')
    print_info "Error esperado para sitio desconocido: $ERROR"
  fi

  echo ""
}

# ============================================================
# TEST: Verbose mode (ver HTML)
# ============================================================

test_verbose() {
  print_header "TEST 4: Verbose Mode"

  URL="https://www.computrabajo.com.ar/busquedas/Python-Developer-Buenos-Aires"
  
  echo "URL: $URL"
  echo "Verbose: true (mostrará HTML snippet)"
  echo ""

  RESPONSE=$(curl -s -X POST "$FUNCTION_URL" \
    -H "Content-Type: application/json" \
    -d "{\"url\": \"$URL\", \"verbose\": true}")

  SUCCESS=$(echo "$RESPONSE" | jq -r '.success')
  
  if [ "$SUCCESS" = "true" ]; then
    print_success "Scraping completado con verbose"
    echo ""
    echo "HTML Snippet (primeros 500 chars):"
    echo "$RESPONSE" | jq -r '.html_snippet' | head -c 500
    echo "..."
  else
    print_error "Error"
  fi

  echo ""
}

# ============================================================
# RESUMEN DE TIMING
# ============================================================

test_timing_breakdown() {
  print_header "TEST 5: Análisis de Timing"

  URL="https://www.computrabajo.com.ar/busquedas/Python-Developer-Buenos-Aires"

  RESPONSE=$(curl -s -X POST "$FUNCTION_URL" \
    -H "Content-Type: application/json" \
    -d "{\"url\": \"$URL\"}")

  if [ "$(echo "$RESPONSE" | jq -r '.success')" = "true" ]; then
    print_success "Timing breakdown:"
    echo ""
    echo "TIMING REPORT:"
    echo "$RESPONSE" | jq '.timing'
    echo ""
    echo "HTML Size: $(echo "$RESPONSE" | jq -r '.html_size_kb') KB"
  fi

  echo ""
}

# ============================================================
# MAIN
# ============================================================

main() {
  echo ""
  print_header "TESTING SUITE — Job Tracker Scraping"
  echo "Función: $FUNCTION_URL"
  echo ""

  # Verificar jq
  if ! command -v jq &> /dev/null; then
    print_error "jq no está instalado. Instálalo con:"
    echo "  macOS: brew install jq"
    echo "  Ubuntu: sudo apt-get install jq"
    exit 1
  fi

  # Verificar SUPABASE_URL
  if [ "$SUPABASE_URL" = "https://xxxxx.supabase.co" ]; then
    print_error "Reemplazá SUPABASE_URL en este script"
    exit 1
  fi

  # Ejecutar tests
  test_computrabajo
  test_invalid_url
  # test_claude_fallback  # (comentado, puede ser lento)
  test_verbose
  test_timing_breakdown

  print_header "Tests completados"
  echo ""
}

main "$@"
