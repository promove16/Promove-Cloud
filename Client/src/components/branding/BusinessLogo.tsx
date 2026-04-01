import { Link } from 'react-router-dom';
import clsx from 'clsx';

interface BusinessLogoProps {
  to?: string;
  className?: string;
  imageWrapperClassName?: string;
  imageClassName?: string;
  titleClassName?: string;
  subtitleClassName?: string;
  title?: string;
  subtitle?: string | null;
}

export function BusinessLogo({
  to,
  className,
  imageWrapperClassName,
  imageClassName,
  titleClassName,
  subtitleClassName,
  title = 'ProMove',
  subtitle = 'Innovation Cloud',
}: BusinessLogoProps) {
  const content = (
    <>
      <span
        className={clsx(
          'flex h-12 w-12 items-center justify-center rounded-none bg-transparent',
          imageWrapperClassName,
        )}
      >
        <img
          src="/image/promoveLogo.png"
          alt="ProMove business logo"
          className={clsx('h-full w-full rounded-none object-contain', imageClassName)}
        />
      </span>
      <span>
        <span className={clsx('block text-2xl font-black tracking-[-0.04em]', titleClassName)}>
          {title}
        </span>
        {subtitle ? (
          <span className={clsx('block text-xs uppercase tracking-[0.28em]', subtitleClassName)}>
            {subtitle}
          </span>
        ) : null}
      </span>
    </>
  );

  if (to) {
    return (
      <Link to={to} className={clsx('inline-flex items-center gap-3', className)}>
        {content}
      </Link>
    );
  }

  return <div className={clsx('inline-flex items-center gap-3', className)}>{content}</div>;
}
