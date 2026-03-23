export default function Alert({ children, variant = 'error' }) {
  const variants = {
    error: 'border-rose-200 bg-rose-50 text-rose-700',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    info: 'border-sky-200 bg-sky-50 text-sky-700',
  };

  return (
    <div className={`rounded-xl border px-4 py-3 text-sm ${variants[variant] || variants.info}`}>
      {children}
    </div>
  );
}
