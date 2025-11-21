import { useState, useEffect, useRef, useCallback } from 'preact/hooks';
import type { FunctionalComponent } from 'preact';
import type { PastSportsEntry } from '../IntakeApp';
import NumberStepper from '../NumberStepper';

type Props = {
  entries: PastSportsEntry[];
  onUpdate: (entries: PastSportsEntry[]) => void;
};

type SportCatalogRow = { id: string; label: string; searchText: string };

const MAX_ITEMS = 5;

const PastSportsStep: FunctionalComponent<Props> = ({ entries, onUpdate }) => {
  const [catalog, setCatalog] = useState<SportCatalogRow[]>([]);
  const [isCatalogLoading, setCatalogLoading] = useState(false);

  useEffect(() => {
    const fetchCatalog = async () => {
      const client = (window as any).SportyApp?.getClient?.();
      if (!client) return;
      setCatalogLoading(true);
      const { data, error } = await client
        .from('sports_subcategories')
        .select('id, name, slug, category')
        .order('name', { ascending: true });

      if (error) {
        console.error('Failed to fetch past sports catalog', error);
      } else {
        const normalized = (data || []).map((row: any) => {
          const label = typeof row.name === 'string' && row.name.trim()
            ? row.name.trim()
            : row.category?.sport?.name || row.slug || 'Sport';
          const searchText = `${label} ${row.slug || ''}`.toLowerCase();
          return { id: row.id, label, searchText };
        });
        setCatalog(normalized);
      }
      setCatalogLoading(false);
    };
    fetchCatalog();
  }, []);

  const handleAdd = () => {
    if (entries.length >= MAX_ITEMS) return;
    const newEntry: PastSportsEntry = {
      id: `new-${Date.now()}`,
      sport_subcategory_id: null,
      sport_label: '',
      years_played: null,
      age_started_years: null,
      intensity: null,
      liked: null,
      had_flair: null,
      achieved_skill: null,
    };
    onUpdate([newEntry, ...entries]);
  };

  const handleRemove = (id: string) => {
    onUpdate(entries.filter((e) => e.id !== id));
  };

  const handleUpdate = (id: string, patch: Partial<PastSportsEntry>) => {
    onUpdate(entries.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  };

  return (
    <div className="card-shell space-y-6" data-step="past-sports">
      <header className="space-y-2">
        <h2 className="type-title text-slate-900">Past sports (optional)</h2>
        <p className="text-slate-600">
          Share up to five sports you’ve played. Signed-in users blend this into future matches.
        </p>
      </header>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-sm text-slate-500">
            {entries.length} / {MAX_ITEMS}
          </span>
          <button
            type="button"
            className="btn-pill btn-pill-secondary btn-pill-sm"
            onClick={handleAdd}
            disabled={entries.length >= MAX_ITEMS}
          >
            Add sport
          </button>
        </div>

        {entries.length === 0 && (
          <p className="text-sm text-slate-500 border border-dashed border-slate-300 rounded-2xl px-4 py-6 text-center">
            Add the sports and disciplines you’ve spent time in. These influence both free and
            premium matches.
          </p>
        )}

        <div className="space-y-4">
          {entries.map((entry) => (
            <PastSportItem
              key={entry.id}
              entry={entry}
              catalog={catalog}
              onChange={(patch) => handleUpdate(entry.id, patch)}
              onRemove={() => handleRemove(entry.id)}
            />
          ))}
        </div>
      </section>
    </div>
  );
};

type ItemProps = {
  entry: PastSportsEntry;
  catalog: SportCatalogRow[];
  onChange: (patch: Partial<PastSportsEntry>) => void;
  onRemove: () => void;
};

const PastSportItem: FunctionalComponent<ItemProps> = ({ entry, catalog, onChange, onRemove }) => {
  const [search, setSearch] = useState(entry.sport_label || '');
  const [showResults, setShowResults] = useState(false);
  const wrapperRef = useRef<HTMLLabelElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredCatalog =
    search.trim() === ''
      ? catalog.slice(0, 20)
      : catalog
        .filter((item) => item.searchText.includes(search.toLowerCase()))
        .slice(0, 20);

  const handleSelectSport = (item: SportCatalogRow) => {
    setSearch(item.label);
    onChange({ sport_subcategory_id: item.id, sport_label: item.label });
    setShowResults(false);
  };

  return (
    <div className="rounded-3xl border border-slate-200/80 bg-white px-4 py-5 shadow-sm space-y-4 transition-all hover:border-slate-300">
      <label className="block space-y-2" ref={wrapperRef}>
        <span className="type-body font-semibold text-slate-800">Sport or discipline</span>
        <div className="relative">
          <input
            type="text"
            className="input-field w-full rounded-xl border-slate-200 px-3 py-2"
            placeholder="Search sports…"
            value={search}
            onInput={(e) => {
              setSearch(e.currentTarget.value);
              setShowResults(true);
              if (entry.sport_subcategory_id) {
                onChange({ sport_subcategory_id: null, sport_label: e.currentTarget.value });
              } else {
                onChange({ sport_label: e.currentTarget.value });
              }
            }}
            onFocus={() => setShowResults(true)}
          />
          {showResults && (
            <div className="absolute inset-x-0 top-full z-20 mt-2 max-h-60 overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-lg">
              {filteredCatalog.length === 0 ? (
                <div className="px-4 py-2 text-sm text-slate-500">No matches found</div>
              ) : (
                filteredCatalog.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="w-full px-4 py-2 text-left text-sm hover:bg-slate-50"
                    onClick={() => handleSelectSport(item)}
                  >
                    {item.label}
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </label>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <span className="type-body font-semibold text-slate-800">Years played</span>
          <p className="text-sm text-slate-500">Total active years (subtract longer breaks).</p>
          <NumberStepper
            step={0.5}
            min={0}
            max={80}
            value={entry.years_played ?? ''}
            onChange={(val) => onChange({ years_played: val === '' || val === null ? null : Number(val) })}
            wrapperClassName="inline-flex w-full max-w-[10rem] items-center overflow-hidden rounded-2xl border border-slate-200 bg-white"
            inputClassName="h-11 w-full px-4 text-right text-lg text-slate-900 focus:outline-none focus:ring-0 bg-white"
            decrementProps={{ className: 'border-r border-slate-200' }}
            incrementProps={{ className: 'border-l border-slate-200' }}
          />
        </div>
        <div className="space-y-2">
          <span className="type-body font-semibold text-slate-800">Starting age</span>
          <p className="text-sm text-slate-500">How old you were when you first played.</p>
          <NumberStepper
            step={1}
            min={0}
            max={80}
            value={entry.age_started_years ?? ''}
            onChange={(val) => onChange({ age_started_years: val === '' || val === null ? null : Number(val) })}
            wrapperClassName="inline-flex w-full max-w-[10rem] items-center overflow-hidden rounded-2xl border border-slate-200 bg-white"
            inputClassName="h-11 w-full px-4 text-right text-lg text-slate-900 focus:outline-none focus:ring-0 bg-white"
            decrementProps={{ className: 'border-r border-slate-200' }}
            incrementProps={{ className: 'border-l border-slate-200' }}
          />
        </div>
        <label className="block space-y-2">
          <span className="type-body font-semibold text-slate-800">Intensity</span>
          <p className="text-sm text-slate-500">How hard did you train relative to your potential?</p>
          <select
            className="input-field w-full bg-white"
            value={entry.intensity || ''}
            onChange={(e) => onChange({ intensity: e.currentTarget.value as any || null })}
          >
            <option value="">Select intensity</option>
            <option value="light">Light</option>
            <option value="moderate">Moderate</option>
            <option value="intense">Intense</option>
            <option value="elite">Elite</option>
          </select>
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <label className="space-y-2">
          <span className="type-body font-semibold text-slate-800">Enjoyed it?</span>
          <select
            className="input-field w-full bg-white"
            value={entry.liked === null ? '' : entry.liked ? 'yes' : 'no'}
            onChange={(e) => {
              const val = e.currentTarget.value;
              onChange({ liked: val === '' ? null : val === 'yes' });
            }}
          >
            <option value="">Select</option>
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
        </label>
        <label className="space-y-2">
          <span className="type-body font-semibold text-slate-800">Felt natural?</span>
          <select
            className="input-field w-full bg-white"
            value={entry.had_flair === null ? '' : entry.had_flair ? 'yes' : 'no'}
            onChange={(e) => {
              const val = e.currentTarget.value;
              onChange({ had_flair: val === '' ? null : val === 'yes' });
            }}
          >
            <option value="">Select</option>
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
        </label>
        <label className="space-y-2">
          <span className="type-body font-semibold text-slate-800">Good at it?</span>
          <select
            className="input-field w-full bg-white"
            value={entry.achieved_skill === null ? '' : entry.achieved_skill ? 'yes' : 'no'}
            onChange={(e) => {
              const val = e.currentTarget.value;
              onChange({ achieved_skill: val === '' ? null : val === 'yes' });
            }}
          >
            <option value="">Select</option>
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
        </label>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          className="text-sm text-red-600 hover:text-red-700 px-3 py-2"
          onClick={onRemove}
        >
          Remove
        </button>
      </div>
    </div>
  );
};

export default PastSportsStep;
