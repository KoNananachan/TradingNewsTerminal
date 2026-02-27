import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useMapEvents, type MapEvent } from '../../api/hooks/use-map-events';
import { useAppStore } from '../../stores/use-app-store';
import { GlassCard } from '../common/glass-card';
import { cleanTitle } from '../../utils/clean-title';
import { Crosshair, Zap, Maximize2, Minimize2 } from 'lucide-react';

const BASEMAP_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';
const SOURCE_ID = 'news-events';
const CIRCLE_LAYER = 'news-circles';
const FLASH_SOURCE = 'flash-events';
const FLASH_LAYER = 'flash-ring';

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
          title: cleanTitle(e.title),
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

export function WorldMapPanel() {
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

    map.on('load', () => {
      if (destroyed) return;

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
    });

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
      const html = `
        <div class="terminal-popup single">
          <div class="popup-header"><span class="pulse-dot"></span>INTEL NODE: ${props.location}</div>
          <button class="popup-item group" data-id="${props.id}">
            <div class="sentiment-bar" style="background-color: ${props.color}"></div>
            <div class="item-content">
              <div class="item-title">${props.title}</div>
            </div>
            <span class="action-hint">VIEW FULL REPORT &rarr;</span>
          </button>
        </div>
      `;
      createPopup(html, lngLat);
    };

    const renderClusterPopup = (leaves: any[], total: number, lngLat: maplibregl.LngLat) => {
      const html = `
        <div class="terminal-popup">
          <div class="popup-header"><span class="pulse-dot"></span>REGIONAL HUB (${total} NODES)</div>
          <div class="popup-list">
            ${leaves.map(leaf => `
              <button class="popup-item group" data-id="${leaf.properties.id}">
                <div class="sentiment-bar" style="background-color: ${leaf.properties.color}"></div>
                <div class="item-content">
                  <div class="item-location">${leaf.properties.location}</div>
                  <div class="item-title">${leaf.properties.title}</div>
                </div>
              </button>
            `).join('')}
          </div>
        </div>
      `;
      createPopup(html, lngLat);
    };

    const createPopup = (html: string, lngLat: maplibregl.LngLat) => {
      if (popupRef.current) popupRef.current.remove();
      popupRef.current = new maplibregl.Popup({ maxWidth: '320px', offset: 15, className: 'custom-terminal-popup', closeButton: false })
        .setLngLat(lngLat)
        .setHTML(html)
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

    map.on('mouseenter', CIRCLE_LAYER, () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', CIRCLE_LAYER, () => { map.getCanvas().style.cursor = ''; });

    const observer = new ResizeObserver(() => map.resize());
    observer.observe(mapContainerRef.current!);

    return () => {
      destroyed = true;
      setIsMapReady(false);
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
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
      if (source) source.setData(toGeoJSON(events, visitedMapNodes));

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
      const onLoad = () => update();
      map.on('load', onLoad);
      return () => { map.off('load', onLoad); };
    }
  }, [isMapReady, events, visitedMapNodes]);

  return (
    <div ref={wrapperRef} className="h-full">
    <GlassCard
      headerRight={
        <div className="flex items-center gap-2">
          <div className="text-[10px] font-mono font-bold text-neutral bg-black/40 px-2 py-0.5 border border-border/30 flex items-center gap-2 tracking-widest leading-none">
            <Crosshair className="w-3 h-3 text-accent"/> {events?.length || 0} NODES
          </div>
          <button
            onClick={toggleFullscreen}
            className="p-1 text-neutral hover:text-accent border border-transparent hover:border-border bg-black/40 transition-none"
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      }
      className="h-full relative overflow-hidden flex flex-col"
    >
      <style>{`
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
          <Zap className="w-3 h-3 text-accent animate-pulse" /> Intelligence Grid
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
                {String(hour).padStart(2, '0')}:00 — Bullish: {b.bullish}, Bearish: {b.bearish}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
