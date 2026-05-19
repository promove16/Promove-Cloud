export default function Footer() {
  return (
    <footer className="border-t border-border/40 py-10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
          <div className="flex items-center gap-2.5">
            <img
              src="/image/promoveLogo.png"
              alt="ProMove Cloud"
              className="h-8 w-8 object-contain"
            />
            <span className="font-heading text-sm font-bold tracking-tight text-foreground">
              ProMove<span className="text-primary">Cloud</span>
            </span>
          </div>
          <p className="text-center font-body text-xs text-muted-foreground">
            © {new Date().getFullYear()} ProMove Cloud. The National Innovation Infrastructure.
          </p>
          <div className="flex items-center gap-6">
            <a
              href="#"
              className="font-body text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              Privacy
            </a>
            <a
              href="#"
              className="font-body text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              Terms
            </a>
            <a
              href="#"
              className="font-body text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              Contact
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
