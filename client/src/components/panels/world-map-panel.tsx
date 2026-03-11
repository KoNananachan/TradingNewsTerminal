import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useQuery } from '@tanstack/react-query';
import { useMapEvents, type MapEvent } from '../../api/hooks/use-map-events';
import { useConflicts, type ConflictEvent } from '../../api/hooks/use-conflicts';
import { api } from '../../api/client';
import { useAppStore } from '../../stores/use-app-store';
import { GlassCard } from '../common/glass-card';
import { cleanTitle } from '../../utils/clean-title';
import { Crosshair, Zap, Maximize2, Minimize2, Flame, TrendingUp, Radio } from 'lucide-react';
import { useT } from '../../i18n';
import { translations } from '../../i18n/translations';
import { getLocalizedTitle } from '../../api/hooks/use-news';

const BASEMAP_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';
const SOURCE_ID = 'news-events';
const CIRCLE_LAYER = 'news-circles';
const FLASH_SOURCE = 'flash-events';
const FLASH_LAYER = 'flash-ring';
const CONFLICT_SOURCE = 'conflict-zones';
const CONFLICT_HEAT_LAYER = 'conflict-heat';
const CONFLICT_POINTS_LAYER = 'conflict-points';
interface IndexQuote {
  symbol: string;
  price: number;
  change: number | null;
  changePercent: number | null;
}

const EXCHANGE_CITIES = [
  { city: 'New York', exchange: 'NYSE', lng: -74.01, lat: 40.71, primary: 'S&P 500', indices: ['S&P 500', 'DOW', 'NASDAQ', 'Russell 2K'] },
  { city: 'Toronto', exchange: 'TSX', lng: -79.38, lat: 43.65, primary: 'TSX', indices: ['TSX'] },
  { city: 'London', exchange: 'LSE', lng: -0.09, lat: 51.51, primary: 'FTSE 100', indices: ['FTSE 100'] },
  { city: 'Paris', exchange: 'Euronext', lng: 2.35, lat: 48.86, primary: 'CAC 40', indices: ['CAC 40'] },
  { city: 'Frankfurt', exchange: 'XETRA', lng: 8.68, lat: 50.11, primary: 'DAX', indices: ['DAX'] },
  { city: 'Mumbai', exchange: 'BSE', lng: 72.88, lat: 19.08, primary: 'Sensex', indices: ['Sensex'] },
  { city: 'Shanghai', exchange: 'SSE', lng: 121.47, lat: 31.23, primary: 'Shanghai', indices: ['Shanghai'] },
  { city: 'Hong Kong', exchange: 'HKEX', lng: 114.16, lat: 22.28, primary: 'Hang Seng', indices: ['Hang Seng'] },
  { city: 'Seoul', exchange: 'KRX', lng: 126.98, lat: 37.57, primary: 'KOSPI', indices: ['KOSPI'] },
  { city: 'Tokyo', exchange: 'TSE', lng: 139.77, lat: 35.68, primary: 'Nikkei', indices: ['Nikkei'] },
  { city: 'Sydney', exchange: 'ASX', lng: 151.21, lat: -33.87, primary: 'ASX 200', indices: ['ASX 200'] },
];

function formatMapPrice(price: number): string {
  if (price >= 10000) return price.toLocaleString('en-US', { maximumFractionDigits: 0 });
  if (price >= 100) return price.toFixed(1);
  return price.toFixed(2);
}

function getSentimentColor(sentiment: string | null): string {
  if (sentiment === 'BULLISH') return '#22c55e';
  if (sentiment === 'BEARISH') return '#ef4444';
  if (sentiment === 'NEUTRAL') return '#3b82f6';
  return '#f97316';
}

const VISITED_COLOR = '#555555';

function toGeoJSON(evts: MapEvent[], visited: number[]): GeoJSON.FeatureCollection {
  const visitedSet = new Set(visited);
  return {
    type: 'FeatureCollection',
    features: (evts || [])
      .filter(e => e.longitude != null && e.latitude != null)
      .map(e => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [e.longitude!, e.latitude!] },
        properties: {
          id: e.id,
          title: cleanTitle(getLocalizedTitle(e)),
          location: e.locationName || 'Location Unknown',
          color: visitedSet.has(e.id) ? VISITED_COLOR : getSentimentColor(e.sentiment),
          sentiment: e.sentiment,
          visited: visitedSet.has(e.id) ? 1 : 0,
        },
      })),
  };
}

function flashGeoJSON(evts: MapEvent[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: evts
      .filter(e => e.longitude != null && e.latitude != null)
      .map(e => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [e.longitude!, e.latitude!] },
        properties: { color: getSentimentColor(e.sentiment) },
      })),
  };
}

function conflictGeoJSON(events: ConflictEvent[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: (events || [])
      .filter(e => e.lat !== 0 || e.lng !== 0)
      .map(e => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [e.lng, e.lat] },
        properties: {
          name: e.name,
          count: e.count,
          url: e.url,
          title: e.title,
        },
      })),
  };
}

export function WorldMapPanel() {
  const t = useT();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const [isMapReady, setIsMapReady] = useState(false);
  const { data: events } = useMapEvents();
  const setSelectedArticleId = useAppStore((s) => s.setSelectedArticleId);
  const markMapNodeVisited = useAppStore((s) => s.markMapNodeVisited);
  const visitedMapNodes = useAppStore((s) => s.visitedMapNodes);
  const eventsRef = useRef(events);
  eventsRef.current = events;
  const visitedRef = useRef(visitedMapNodes);
  visitedRef.current = visitedMapNodes;

  // Track previous event IDs to detect new arrivals
  const prevEventIdsRef = useRef<Set<number>>(new Set());
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: conflicts } = useConflicts();
  const [showConflicts, setShowConflicts] = useState(true);
  const [showExchanges, setShowExchanges] = useState(true);
  const [showNews, setShowNews] = useState(true);
  const { data: indexQuotes } = useQuery({
    queryKey: ['indices'],
    queryFn: () => api.get<IndexQuote[]>('/stocks/indices'),
    refetchInterval: 60_000,
  });

  const exchangeMarkersRef = useRef<maplibregl.Marker[]>([]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!wrapperRef.current) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      wrapperRef.current.requestFullscreen();
    }
  }, []);

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: BASEMAP_STYLE,
      center: [20, 20],
      zoom: 1.2,
      attributionControl: false,
    });

    mapRef.current = map;
    let destroyed = false;

    // Use 'style.load' instead of 'load' — 'load' waits for ALL tiles
    // which may never complete if some tile fetches fail, blocking layer init.
    const onStyleLoad = () => {
      if (destroyed) return;
      // Style loaded, initializing layers

      // Conflict data source + layers (rendered below news dots)
      map.addSource(CONFLICT_SOURCE, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      map.addLayer({
        id: CONFLICT_HEAT_LAYER,
        type: 'heatmap',
        source: CONFLICT_SOURCE,
        paint: {
          'heatmap-weight': ['interpolate', ['linear'], ['get', 'count'], 0, 0.2, 500, 0.6, 5000, 1, 50000, 2],
          'heatmap-intensity': 1.2,
          'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 0, 8, 5, 25, 10, 40],
          'heatmap-color': [
            'interpolate', ['linear'], ['heatmap-density'],
            0, 'rgba(0,0,0,0)',
            0.2, 'rgba(255,100,0,0.3)',
            0.4, 'rgba(255,80,0,0.5)',
            0.6, 'rgba(255,50,0,0.65)',
            0.8, 'rgba(220,20,0,0.8)',
            1, 'rgba(180,0,0,0.9)',
          ],
          'heatmap-opacity': 0.7,
        },
      });

      map.addLayer({
        id: CONFLICT_POINTS_LAYER,
        type: 'circle',
        source: CONFLICT_SOURCE,
        paint: {
          'circle-color': '#ef4444',
          'circle-radius': ['interpolate', ['linear'], ['get', 'count'], 0, 3, 500, 5, 5000, 7, 50000, 10],
          'circle-opacity': 0.6,
          'circle-stroke-width': 0.5,
          'circle-stroke-color': 'rgba(255,100,100,0.4)',
        },
      });

      // Main data source
      map.addSource(SOURCE_ID, {
        type: 'geojson',
        data: toGeoJSON(eventsRef.current || [], visitedRef.current),
      });

      // Flash source for new event animations
      map.addSource(FLASH_SOURCE, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      // Main colored dots — visited ones are gray
      map.addLayer({
        id: CIRCLE_LAYER,
        type: 'circle',
        source: SOURCE_ID,
        paint: {
          'circle-color': ['get', 'color'],
          'circle-radius': 6,
          'circle-stroke-width': 1.5,
          'circle-stroke-color': ['case',
            ['==', ['get', 'visited'], 1], 'rgba(255,255,255,0.15)',
            'rgba(255,255,255,0.5)',
          ],
          'circle-opacity': ['case',
            ['==', ['get', 'visited'], 1], 0.4,
            0.9,
          ],
        },
      });

      // Flash ring layer — expanding ring for new events (outer)
      map.addLayer({
        id: FLASH_LAYER,
        type: 'circle',
        source: FLASH_SOURCE,
        paint: {
          'circle-color': 'transparent',
          'circle-radius': 10,
          'circle-stroke-width': 2.5,
          'circle-stroke-color': ['get', 'color'],
          'circle-opacity': 1,
        },
      });

      // Inner glow layer for new events
      map.addLayer({
        id: FLASH_LAYER + '-glow',
        type: 'circle',
        source: FLASH_SOURCE,
        paint: {
          'circle-color': ['get', 'color'],
          'circle-radius': 10,
          'circle-blur': 1.5,
          'circle-opacity': 0.6,
        },
      });

      setIsMapReady(true);
    };

    // style.load fires once the style JSON is parsed — no need to wait for tiles.
    // Also listen for 'load' as a fallback in case style.load already fired.
    if (map.isStyleLoaded()) {
      onStyleLoad();
    } else {
      map.once('style.load', onStyleLoad);
      // Safety fallback: if style.load doesn't fire within 5s, try 'load' event
      const fallbackTimer = setTimeout(() => {
        if (!destroyed && !map.getSource(SOURCE_ID)) {
          // style.load timeout, fallback to 'load' event
          map.once('load', onStyleLoad);
        }
      }, 5000);
      // Clear fallback if onStyleLoad already ran
      const origOnStyleLoad = onStyleLoad;
      // No need to reassign — fallback checks if source exists
    }

    // Click handler
    map.on('click', CIRCLE_LAYER, (e) => {
      if (!e.features?.length) return;
      const allFeatures = map.queryRenderedFeatures(e.point, { layers: [CIRCLE_LAYER] });
      if (allFeatures.length > 1) {
        renderClusterPopup(allFeatures as any[], allFeatures.length, e.lngLat);
      } else {
        renderSinglePopup(e.features[0].properties, e.lngLat);
      }
    });

    const renderSinglePopup = (props: any, lngLat: maplibregl.LngLat) => {
      const container = document.createElement('div');
      container.className = 'terminal-popup single';

      const header = document.createElement('div');
      header.className = 'popup-header';
      const dot = document.createElement('span');
      dot.className = 'pulse-dot';
      header.appendChild(dot);
      const loc = useAppStore.getState().locale;
      const tt = (k: keyof typeof translations.en) => translations[loc]?.[k] ?? translations.en[k];
      header.appendChild(document.createTextNode(`${tt('intelNode')} ${props.location || ''}`));
      container.appendChild(header);

      const btn = document.createElement('button');
      btn.className = 'popup-item group';
      btn.dataset.id = String(props.id);

      const bar = document.createElement('div');
      bar.className = 'sentiment-bar';
      bar.style.backgroundColor = String(props.color || '#888').replace(/[^#a-zA-Z0-9(),.\s]/g, '');
      btn.appendChild(bar);

      const content = document.createElement('div');
      content.className = 'item-content';
      const titleEl = document.createElement('div');
      titleEl.className = 'item-title';
      titleEl.textContent = props.title || '';
      content.appendChild(titleEl);
      btn.appendChild(content);

      const hint = document.createElement('span');
      hint.className = 'action-hint';
      hint.textContent = `${tt('viewFullReport')} →`;
      btn.appendChild(hint);

      container.appendChild(btn);
      createPopup(container, lngLat);
    };

    const renderClusterPopup = (leaves: any[], total: number, lngLat: maplibregl.LngLat) => {
      const container = document.createElement('div');
      container.className = 'terminal-popup';

      const header = document.createElement('div');
      header.className = 'popup-header';
      const dot = document.createElement('span');
      dot.className = 'pulse-dot';
      header.appendChild(dot);
      const loc = useAppStore.getState().locale;
      const tt = (k: keyof typeof translations.en) => translations[loc]?.[k] ?? translations.en[k];
      header.appendChild(document.createTextNode(tt('regionalHub').replace('{count}', String(total))));
      container.appendChild(header);

      const list = document.createElement('div');
      list.className = 'popup-list';

      leaves.forEach(leaf => {
        const btn = document.createElement('button');
        btn.className = 'popup-item group';
        btn.dataset.id = String(leaf.properties.id);

        const bar = document.createElement('div');
        bar.className = 'sentiment-bar';
        bar.style.backgroundColor = String(leaf.properties.color || '#888').replace(/[^#a-zA-Z0-9(),.\s]/g, '');
        btn.appendChild(bar);

        const content = document.createElement('div');
        content.className = 'item-content';
        const loc = document.createElement('div');
        loc.className = 'item-location';
        loc.textContent = leaf.properties.location || '';
        content.appendChild(loc);
        const title = document.createElement('div');
        title.className = 'item-title';
        title.textContent = leaf.properties.title || '';
        content.appendChild(title);
        btn.appendChild(content);

        list.appendChild(btn);
      });

      container.appendChild(list);
      createPopup(container, lngLat);
    };

    const createPopup = (content: HTMLElement, lngLat: maplibregl.LngLat) => {
      if (popupRef.current) popupRef.current.remove();
      popupRef.current = new maplibregl.Popup({ maxWidth: '320px', offset: 15, className: 'custom-terminal-popup', closeButton: false })
        .setLngLat(lngLat)
        .setDOMContent(content)
        .addTo(map);

      setTimeout(() => {
        popupRef.current?.getElement().querySelectorAll('.popup-item').forEach(btn => {
          btn.addEventListener('click', (ev) => {
            ev.stopPropagation();
            const id = (btn as HTMLElement).dataset.id;
            if (id) {
              const numId = parseInt(id);
              markMapNodeVisited(numId);
              setSelectedArticleId(numId);
              popupRef.current?.remove();
            }
          });
        });
      }, 0);
    };

    // Conflict points click handler
    map.on('click', CONFLICT_POINTS_LAYER, (e) => {
      if (!e.features?.length) return;
      const props = e.features[0].properties;
      if (!props) return;

      const container = document.createElement('div');
      container.className = 'terminal-popup single';

      const header = document.createElement('div');
      header.className = 'popup-header';
      header.style.cssText = 'background:rgba(239,68,68,0.15);border-color:rgba(239,68,68,0.2);color:#ef4444;';
      const dot = document.createElement('span');
      dot.className = 'pulse-dot';
      dot.style.cssText = 'background:#ef4444;box-shadow:0 0 10px #ef4444;';
      header.appendChild(dot);
      const loc = useAppStore.getState().locale;
      const tt = (k: keyof typeof translations.en) => translations[loc]?.[k] ?? translations.en[k];
      header.appendChild(document.createTextNode(tt('conflictZone')));
      container.appendChild(header);

      const body = document.createElement('div');
      body.style.cssText = "padding:12px 16px;font-family:'JetBrains Mono',monospace;";

      const nameEl = document.createElement('div');
      nameEl.style.cssText = 'font-size:12px;color:#f4f4f5;font-weight:700;margin-bottom:6px;';
      nameEl.textContent = props.name || '';
      body.appendChild(nameEl);

      const countEl = document.createElement('div');
      countEl.style.cssText = 'font-size:10px;color:#fbbf24;font-weight:700;margin-bottom:8px;';
      countEl.textContent = tt('conflictMentions3d').replace('{count}', Number(props.count).toLocaleString());
      body.appendChild(countEl);

      if (props.title) {
        const titleEl = document.createElement('div');
        titleEl.style.cssText = 'font-size:11px;color:#d4d4d8;line-height:1.5;margin-bottom:8px;';
        titleEl.textContent = props.title;
        body.appendChild(titleEl);
      }

      if (props.url) {
        const link = document.createElement('a');
        link.href = props.url;
        link.target = '_blank';
        link.rel = 'noopener';
        link.style.cssText = 'font-size:9px;color:#ef4444;font-weight:900;text-decoration:none;letter-spacing:0.1em;';
        link.textContent = `${tt('mapViewSource')} →`;
        body.appendChild(link);
      }

      container.appendChild(body);

      if (popupRef.current) popupRef.current.remove();
      popupRef.current = new maplibregl.Popup({ maxWidth: '320px', offset: 15, className: 'custom-terminal-popup', closeButton: false })
        .setLngLat(e.lngLat)
        .setDOMContent(container)
        .addTo(map);
    });

    map.on('mouseenter', CIRCLE_LAYER, () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', CIRCLE_LAYER, () => { map.getCanvas().style.cursor = ''; });
    map.on('mouseenter', CONFLICT_POINTS_LAYER, () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', CONFLICT_POINTS_LAYER, () => { map.getCanvas().style.cursor = ''; });

    const observer = new ResizeObserver(() => map.resize());
    observer.observe(mapContainerRef.current!);

    return () => {
      destroyed = true;
      setIsMapReady(false);
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
      exchangeMarkersRef.current.forEach(m => m.remove());
      exchangeMarkersRef.current = [];
      observer.disconnect();
      mapRef.current = null;
      map.remove();
    };
  }, []);

  // Update map data when events, visited state, or map readiness changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !events) return;

    const update = () => {
      const source = map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
      if (source) {
        const geoData = toGeoJSON(events, visitedMapNodes);
        source.setData(geoData);
        // dots updated
      } else {
        // source not ready yet
      }

      // Detect new events and trigger flash animation
      const currentIds = new Set(events.map(e => e.id));
      const newEvents = events.filter(e => !prevEventIdsRef.current.has(e.id));

      if (newEvents.length > 0 && prevEventIdsRef.current.size > 0) {
        // Only flash if we had previous data (not the initial load)
        const flashSource = map.getSource(FLASH_SOURCE) as maplibregl.GeoJSONSource | undefined;
        if (flashSource) {
          flashSource.setData(flashGeoJSON(newEvents));

          // Animate expanding ring + glow over 3.5 seconds
          let frame = 0;
          const totalFrames = 70; // ~3.5s at 50ms interval
          const animId = setInterval(() => {
            frame++;
            const progress = frame / totalFrames;
            // Outer ring: expands to large radius
            const ringRadius = 10 + 50 * progress;
            const ringOpacity = 1 * (1 - progress);
            const strokeWidth = 2.5 * (1 - progress * 0.6);
            // Inner glow: expands slightly slower, fades out
            const glowRadius = 10 + 35 * progress;
            const glowOpacity = 0.6 * (1 - progress * progress);

            if (map.getLayer(FLASH_LAYER)) {
              map.setPaintProperty(FLASH_LAYER, 'circle-radius', ringRadius);
              map.setPaintProperty(FLASH_LAYER, 'circle-opacity', ringOpacity);
              map.setPaintProperty(FLASH_LAYER, 'circle-stroke-width', strokeWidth);
            }
            if (map.getLayer(FLASH_LAYER + '-glow')) {
              map.setPaintProperty(FLASH_LAYER + '-glow', 'circle-radius', glowRadius);
              map.setPaintProperty(FLASH_LAYER + '-glow', 'circle-opacity', glowOpacity);
            }

            if (frame >= totalFrames) {
              clearInterval(animId);
              if (flashSource) flashSource.setData({ type: 'FeatureCollection', features: [] });
              if (map.getLayer(FLASH_LAYER)) {
                map.setPaintProperty(FLASH_LAYER, 'circle-radius', 10);
                map.setPaintProperty(FLASH_LAYER, 'circle-opacity', 1);
                map.setPaintProperty(FLASH_LAYER, 'circle-stroke-width', 2.5);
              }
              if (map.getLayer(FLASH_LAYER + '-glow')) {
                map.setPaintProperty(FLASH_LAYER + '-glow', 'circle-radius', 10);
                map.setPaintProperty(FLASH_LAYER + '-glow', 'circle-opacity', 0.6);
              }
            }
          }, 50);
        }
      }

      prevEventIdsRef.current = currentIds;
    };

    if (isMapReady) {
      update();
    } else {
      const onReady = () => update();
      map.once('style.load', onReady);
      return () => { map.off('style.load', onReady); };
    }
  }, [isMapReady, events, visitedMapNodes]);

  // Toggle news dots visibility
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapReady) return;
    const vis = showNews ? 'visible' : 'none';
    if (map.getLayer(CIRCLE_LAYER)) map.setLayoutProperty(CIRCLE_LAYER, 'visibility', vis);
    if (map.getLayer(FLASH_LAYER)) map.setLayoutProperty(FLASH_LAYER, 'visibility', vis);
    if (map.getLayer(FLASH_LAYER + '-glow')) map.setLayoutProperty(FLASH_LAYER + '-glow', 'visibility', vis);
  }, [isMapReady, showNews]);

  // Update conflict layers
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapReady) return;

    const source = map.getSource(CONFLICT_SOURCE) as maplibregl.GeoJSONSource | undefined;
    if (source) {
      const emptyCollection: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };
      const conflictData = showConflicts && conflicts ? conflictGeoJSON(conflicts) : emptyCollection;
      source.setData(conflictData);
      // conflict zones updated
    }

    if (map.getLayer(CONFLICT_HEAT_LAYER)) {
      map.setLayoutProperty(CONFLICT_HEAT_LAYER, 'visibility', showConflicts ? 'visible' : 'none');
    }
    if (map.getLayer(CONFLICT_POINTS_LAYER)) {
      map.setLayoutProperty(CONFLICT_POINTS_LAYER, 'visibility', showConflicts ? 'visible' : 'none');
    }
  }, [isMapReady, conflicts, showConflicts]);

  // Update exchange HTML markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Clear old markers
    exchangeMarkersRef.current.forEach(m => m.remove());
    exchangeMarkersRef.current = [];

    if (!showExchanges || !indexQuotes || !isMapReady) return;

    const quoteMap = new Map(indexQuotes.map(q => [q.symbol, q]));

    for (const city of EXCHANGE_CITIES) {
      const pq = quoteMap.get(city.primary);
      if (!pq) continue;

      const pct = pq.changePercent ?? 0;
      const up = pct >= 0;
      const rgb = up ? '34,197,94' : '239,68,68';
      const hex = up ? '#22c55e' : '#ef4444';
      const arrow = up ? '▲' : '▼';

      const el = document.createElement('div');
      el.style.cssText = `
        display:flex;flex-direction:column;align-items:center;
        padding:2px 5px;border-radius:3px;cursor:pointer;
        font-family:'JetBrains Mono',monospace;
        background:rgba(${rgb},0.2);
        border:1px solid rgba(${rgb},0.6);
        box-shadow:0 0 10px rgba(${rgb},0.25);
        pointer-events:auto;
      `;
      const label = document.createElement('span');
      label.style.cssText = 'font-size:7px;font-weight:900;color:rgba(255,255,255,0.7);letter-spacing:0.08em;line-height:1;';
      label.textContent = city.exchange;
      const value = document.createElement('span');
      value.style.cssText = `font-size:9px;font-weight:900;color:${hex};line-height:1.3;`;
      value.textContent = `${arrow}${Math.abs(pct).toFixed(2)}%`;
      el.appendChild(label);
      el.appendChild(value);

      el.addEventListener('click', (evt) => {
        evt.stopPropagation();
        const indices = city.indices.map(sym => quoteMap.get(sym)).filter(Boolean) as IndexQuote[];
        const hc = up ? '#22c55e' : '#ef4444';

        // Build popup DOM safely (no innerHTML with dynamic data)
        const popupEl = document.createElement('div');
        popupEl.className = 'terminal-popup single';

        const header = document.createElement('div');
        header.className = 'popup-header';
        header.style.cssText = `background:${hc}15;border-color:${hc}33;color:${hc};`;
        const dot = document.createElement('span');
        dot.className = 'pulse-dot';
        dot.style.cssText = `background:${hc};box-shadow:0 0 10px ${hc};`;
        header.appendChild(dot);
        header.appendChild(document.createTextNode(` ${city.exchange} — ${city.city}`));
        popupEl.appendChild(header);

        const body = document.createElement('div');
        body.style.cssText = 'padding:8px 16px;font-family:"JetBrains Mono",monospace;';
        for (const q of indices) {
          const qUp = (q.changePercent ?? 0) >= 0;
          const clr = qUp ? '#22c55e' : '#ef4444';
          const ar = qUp ? '▲' : '▼';
          const row = document.createElement('div');
          row.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.05);';
          const sym = document.createElement('span');
          sym.style.cssText = 'font-size:11px;color:#f4f4f5;font-weight:700;';
          sym.textContent = q.symbol;
          const right = document.createElement('div');
          right.style.cssText = 'text-align:right;';
          const priceSpan = document.createElement('span');
          priceSpan.style.cssText = 'font-size:11px;color:#f4f4f5;font-weight:700;';
          priceSpan.textContent = formatMapPrice(q.price);
          const changeSpan = document.createElement('span');
          changeSpan.style.cssText = `font-size:10px;color:${clr};font-weight:700;margin-left:8px;`;
          changeSpan.textContent = q.changePercent != null ? `${ar} ${Math.abs(q.changePercent).toFixed(2)}%` : '';
          right.appendChild(priceSpan);
          right.appendChild(changeSpan);
          row.appendChild(sym);
          row.appendChild(right);
          body.appendChild(row);
        }
        popupEl.appendChild(body);

        if (popupRef.current) popupRef.current.remove();
        popupRef.current = new maplibregl.Popup({ maxWidth: '320px', offset: 15, className: 'custom-terminal-popup', closeButton: false })
          .setLngLat([city.lng, city.lat])
          .setDOMContent(popupEl)
          .addTo(map);
      });

      const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
        .setLngLat([city.lng, city.lat])
        .addTo(map);
      exchangeMarkersRef.current.push(marker);
    }
  }, [isMapReady, indexQuotes, showExchanges]);

  return (
    <div ref={wrapperRef} className="h-full">
    <GlassCard
      headerRight={
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowNews(v => !v)}
            className={`text-[10px] font-mono font-bold px-2 py-0.5 border flex items-center gap-1.5 tracking-widest leading-none transition-colors ${
              showNews
                ? 'text-blue-400 bg-blue-500/10 border-blue-500/30'
                : 'text-neutral bg-black/40 border-border/30 opacity-50'
            }`}
            title={showNews ? t('hideNews') : t('showNewsTitle')}
          >
            <Radio className="w-3 h-3" /> {t('mapNews')}
          </button>
          <button
            onClick={() => setShowExchanges(v => !v)}
            className={`text-[10px] font-mono font-bold px-2 py-0.5 border flex items-center gap-1.5 tracking-widest leading-none transition-colors ${
              showExchanges
                ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
                : 'text-neutral bg-black/40 border-border/30 opacity-50'
            }`}
            title={showExchanges ? t('hideMarkets') : t('showMarketsTitle')}
          >
            <TrendingUp className="w-3 h-3" /> {t('mapMarkets')}
          </button>
          <button
            onClick={() => setShowConflicts(v => !v)}
            className={`text-[10px] font-mono font-bold px-2 py-0.5 border flex items-center gap-1.5 tracking-widest leading-none transition-colors ${
              showConflicts
                ? 'text-red-400 bg-red-500/10 border-red-500/30'
                : 'text-neutral bg-black/40 border-border/30 opacity-50'
            }`}
            title={showConflicts ? t('hideConflicts') : t('showConflictsTitle')}
          >
            <Flame className="w-3 h-3" /> {t('mapConflicts')}
          </button>
          <div className="text-[10px] font-mono font-bold text-neutral bg-black/40 px-2 py-0.5 border border-border/30 flex items-center gap-2 tracking-widest leading-none">
            <Crosshair className="w-3 h-3 text-accent"/> {events?.length || 0} {t('mapNodes')}
          </div>
          <button
            onClick={toggleFullscreen}
            className="p-1 text-neutral hover:text-accent border border-transparent hover:border-border bg-black/40 transition-colors"
            title={isFullscreen ? t('exitFullscreen') : t('fullscreen')}
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      }
      className="h-full relative overflow-hidden flex flex-col"
    >
      <style>{`
        .maplibregl-map { width: 100% !important; height: 100% !important; }
        .maplibregl-canvas { width: 100% !important; height: 100% !important; }
        .custom-terminal-popup .maplibregl-popup-content {
          padding: 0; background: transparent; border: none; box-shadow: none;
        }
        .custom-terminal-popup .maplibregl-popup-tip {
          border-top-color: rgba(10, 10, 10, 0.98);
        }
        .terminal-popup {
          background: rgba(10, 10, 10, 0.98);
          border: 1px solid rgba(34, 197, 94, 0.4);
          border-radius: 4px;
          overflow: hidden;
          box-shadow: 0 20px 50px rgba(0,0,0,0.9);
          backdrop-filter: blur(15px);
          font-family: 'JetBrains Mono', monospace;
        }
        .popup-header {
          padding: 10px 14px;
          background: rgba(34, 197, 94, 0.15);
          border-bottom: 1px solid rgba(34, 197, 94, 0.2);
          color: #22c55e;
          font-size: 10px;
          font-weight: 900;
          letter-spacing: 0.15em;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .pulse-dot {
          width: 8px; height: 8px; background: #22c55e; border-radius: 50%;
          box-shadow: 0 0 10px #22c55e; animation: pulse-soft 2s infinite;
        }
        .popup-list { max-height: 300px; overflow-y: auto; }
        .popup-item {
          width: 100%; display: flex; flex-direction: column; padding: 12px 16px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05); text-align: left;
          background: transparent; cursor: pointer; position: relative;
          transition: background 0.2s;
        }
        .popup-item:hover { background: rgba(34, 197, 94, 0.1); }
        .sentiment-bar { width: 4px; height: 100%; position: absolute; left: 0; top: 0; }
        .item-location { font-size: 9px; color: #22c55e; font-weight: 800; margin-bottom: 4px; opacity: 0.8; }
        .item-title { font-size: 12px; color: #f4f4f5; line-height: 1.4; font-weight: 600; }
        .action-hint { font-size: 9px; color: #22c55e; font-weight: 900; margin-top: 10px; align-self: flex-end; }
      `}</style>

      <div className="absolute top-3 left-3 z-20 flex flex-col gap-2 pointer-events-none">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-black/80 backdrop-blur-md rounded border border-accent/20 text-[9px] font-black text-accent uppercase tracking-[0.2em] shadow-2xl">
          <Zap className="w-3 h-3 text-accent animate-pulse" /> {t('intelligenceGrid')}
        </div>
      </div>

      <div className="flex-1 min-h-0 relative">
        <div ref={mapContainerRef} className="w-full h-full bg-black z-10" />
        <div className="absolute inset-0 pointer-events-none shadow-[inset_0_0_120px_rgba(0,0,0,0.8)] z-20" />
      </div>
      <SentimentTimeline events={events || []} />
    </GlassCard>
    </div>
  );
}

function SentimentTimeline({ events }: { events: MapEvent[] }) {
  const t = useT();
  const [hoveredHour, setHoveredHour] = useState<number | null>(null);

  const buckets = useMemo(() => {
    const now = Date.now();
    const hourBuckets = Array.from({ length: 24 }, () => ({ bullish: 0, bearish: 0 }));

    for (const ev of events) {
      if (!ev.scrapedAt) continue;
      const age = now - new Date(ev.scrapedAt).getTime();
      const hoursAgo = Math.floor(age / (1000 * 60 * 60));
      if (hoursAgo < 0 || hoursAgo >= 24) continue;
      const idx = 23 - hoursAgo; // leftmost = oldest
      if (ev.sentiment === 'BULLISH') hourBuckets[idx].bullish++;
      else if (ev.sentiment === 'BEARISH') hourBuckets[idx].bearish++;
    }

    const maxVal = Math.max(1, ...hourBuckets.map(b => b.bullish + b.bearish));
    return hourBuckets.map(b => ({
      ...b,
      bullishH: (b.bullish / maxVal) * 100,
      bearishH: (b.bearish / maxVal) * 100,
    }));
  }, [events]);

  return (
    <div className="h-10 shrink-0 border-t border-border/30 bg-black/40 flex items-end px-2 gap-[2px] z-10 relative">
      {buckets.map((b, i) => {
        const hour = new Date(Date.now() - (23 - i) * 60 * 60 * 1000).getHours();
        return (
          <div
            key={i}
            className="flex-1 flex flex-col justify-end h-full relative cursor-pointer"
            onMouseEnter={() => setHoveredHour(i)}
            onMouseLeave={() => setHoveredHour(null)}
          >
            <div className="bg-bullish/60 rounded-t-[1px]" style={{ height: `${b.bullishH}%`, minHeight: b.bullish > 0 ? 1 : 0 }} />
            <div className="bg-bearish/60 rounded-b-[1px]" style={{ height: `${b.bearishH}%`, minHeight: b.bearish > 0 ? 1 : 0 }} />
            {hoveredHour === i && (
              <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-black/95 border border-border/50 rounded px-2 py-1 text-[8px] font-mono text-gray-300 whitespace-nowrap z-50 pointer-events-none">
                {String(hour).padStart(2, '0')}:00 — {t('bullish')}: {b.bullish}, {t('bearish')}: {b.bearish}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
