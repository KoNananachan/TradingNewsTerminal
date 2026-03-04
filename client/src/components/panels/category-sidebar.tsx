import { useCategories } from '../../api/hooks/use-categories';
import { useAppStore } from '../../stores/use-app-store';

export function CategorySidebar() {
  const { data: categories } = useCategories();
  const selectedCategory = useAppStore((s) => s.selectedCategory);
  const setSelectedCategory = useAppStore((s) => s.setSelectedCategory);

  return (
    <div className="flex gap-1 px-4 py-2 overflow-x-auto no-scrollbar bg-black border-b border-border">
      <button
        onClick={() => setSelectedCategory(null)}
        className={`shrink-0 px-3 py-1 text-[10px] font-bold uppercase tracking-widest transition-colors border ${
          selectedCategory === null
            ? 'bg-accent text-black border-accent'
            : 'bg-black border-border text-neutral hover:border-accent hover:text-accent'
        }`}
      >
        ALL
      </button>
      {categories?.map((cat) => {
        const isSelected = selectedCategory === cat.slug;
        return (
          <button
            key={cat.slug}
            onClick={() => setSelectedCategory(isSelected ? null : cat.slug)}
            className={`shrink-0 px-3 py-1 text-[10px] font-bold uppercase tracking-widest transition-colors border flex items-center gap-2 ${
              isSelected
                ? ''
                : 'bg-black border-border text-neutral hover:border-accent hover:text-accent'
            }`}
            style={
              isSelected && cat.color
                ? { backgroundColor: `${cat.color}22`, borderColor: cat.color, color: cat.color }
                : undefined
            }
          >
            {cat.name}
            <span className={`px-1 font-mono text-[9px] ${isSelected ? 'bg-black/40' : 'bg-border text-neutral'}`}>{cat._count.articles}</span>
          </button>
        );
      })}
    </div>
  );
}
