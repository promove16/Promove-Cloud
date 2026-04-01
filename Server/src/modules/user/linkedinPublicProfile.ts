import { IUser } from './user.types';

export interface LinkedInPublicProfileData {
  handle: string;
  canonicalUrl: string;
  displayName?: string;
  headline?: string;
  location?: string;
  bio?: string;
  avatar?: string;
  skills: IUser['skills'];
  experience: IUser['experience'];
  education: IUser['education'];
  certifications: IUser['certifications'];
}

const LINKEDIN_FETCH_HEADERS = {
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Cache-Control': 'no-cache',
  Pragma: 'no-cache',
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 ProMove/1.0',
};

const HTML_ENTITY_MAP: Record<string, string> = {
  '&amp;': '&',
  '&apos;': "'",
  '&#39;': "'",
  '&quot;': '"',
  '&lt;': '<',
  '&gt;': '>',
  '&nbsp;': ' ',
};

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const decodeHtmlEntities = (value: string) =>
  value
    .replace(/&(amp|apos|quot|lt|gt|nbsp|#39);/g, (entity) => HTML_ENTITY_MAP[entity] ?? entity)
    .replace(/&#(\d+);/g, (_match, code) => {
      const parsed = Number(code);
      return Number.isFinite(parsed) ? String.fromCharCode(parsed) : '';
    });

const normalizeWhitespace = (value: string) => value.replace(/\s+/g, ' ').trim();

const stripHtml = (value: string) =>
  normalizeWhitespace(
    decodeHtmlEntities(
      value
        .replace(/<br\s*\/?>/gi, ' ')
        .replace(/<\/(p|div|li|section|h1|h2|h3|h4|span)>/gi, ' ')
        .replace(/<[^>]+>/g, ' '),
    ),
  );

const extractMetaContent = (html: string, key: string) => {
  const escapedKey = escapeRegExp(key);
  const patterns = [
    new RegExp(
      `<meta[^>]+(?:property|name)=["']${escapedKey}["'][^>]+content=["']([^"']+)["'][^>]*>`,
      'i',
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escapedKey}["'][^>]*>`,
      'i',
    ),
  ];

  for (const pattern of patterns) {
    const match = pattern.exec(html);
    if (match?.[1]) {
      return stripHtml(match[1]);
    }
  }

  return '';
};

const extractTagTextByClass = (html: string, tag: string, classFragment: string) => {
  const escapedClass = escapeRegExp(classFragment);
  const pattern = new RegExp(
    `<${tag}[^>]*class=["'][^"']*${escapedClass}[^"']*["'][^>]*>([\\s\\S]*?)<\\/${tag}>`,
    'i',
  );
  const match = pattern.exec(html);
  return match?.[1] ? stripHtml(match[1]) : '';
};

const extractImgSrcByClass = (html: string, classFragment: string) => {
  const escapedClass = escapeRegExp(classFragment);
  const patterns = [
    new RegExp(
      `<img[^>]*class=["'][^"']*${escapedClass}[^"']*["'][^>]*src=["']([^"']+)["'][^>]*>`,
      'i',
    ),
    new RegExp(
      `<img[^>]*src=["']([^"']+)["'][^>]*class=["'][^"']*${escapedClass}[^"']*["'][^>]*>`,
      'i',
    ),
  ];

  for (const pattern of patterns) {
    const match = pattern.exec(html);
    if (match?.[1]) {
      return stripHtml(match[1]);
    }
  }

  return '';
};

const extractSectionText = (html: string, headingText: string) => {
  const escapedHeading = escapeRegExp(headingText);
  const sectionPattern = new RegExp(
    `<section[^>]*>[\\s\\S]*?<h2[^>]*>\\s*${escapedHeading}\\s*<\\/h2>([\\s\\S]*?)<\\/section>`,
    'i',
  );
  const sectionMatch = sectionPattern.exec(html);

  if (!sectionMatch?.[1]) {
    return '';
  }

  const content = sectionMatch[1];
  const directCandidates = [
    /<div[^>]*class=["'][^"']*show-more-less-text[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
    /<div[^>]*class=["'][^"']*core-section-container__content[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
    /<p[^>]*>([\s\S]*?)<\/p>/i,
  ];

  for (const pattern of directCandidates) {
    const match = pattern.exec(content);
    const text = match?.[1] ? stripHtml(match[1]) : '';
    if (text) {
      return text;
    }
  }

  return stripHtml(content);
};

const stripLinkedInBranding = (value: string) =>
  normalizeWhitespace(
    value
      .replace(/\s*\|\s*LinkedIn\s*$/i, '')
      .replace(/^View\s+/i, '')
      .replace(/\s+profile on LinkedIn.*$/i, ''),
  );

const getTitleParts = (title: string) => {
  const cleaned = stripLinkedInBranding(title);
  const segments = cleaned
    .split(/\s[-|]\s/)
    .map((segment) => normalizeWhitespace(segment))
    .filter(Boolean);

  return {
    displayName: segments[0] ?? '',
    headline: segments.slice(1).join(' - '),
  };
};

const extractLocation = (html: string) => {
  const classCandidates = [
    'top-card__subline-item',
    'top-card-layout__first-subline',
    'top-card-layout__second-subline',
  ];

  for (const className of classCandidates) {
    const text = extractTagTextByClass(html, 'span', className) || extractTagTextByClass(html, 'div', className);
    if (
      text &&
      !/followers|connections|contact info|500\+|message|view/i.test(text)
    ) {
      return text;
    }
  }

  return '';
};

const buildCanonicalLinkedInUrl = (handle: string) => `https://www.linkedin.com/${handle.replace(/^\/+|\/+$/g, '')}`;

export const fetchLinkedInPublicProfile = async (
  linkedinUrl: string,
  handle: string,
): Promise<LinkedInPublicProfileData> => {
  const response = await fetch(linkedinUrl, {
    headers: LINKEDIN_FETCH_HEADERS,
    redirect: 'follow',
  });

  if (response.status === 404) {
    throw new Error('LINKEDIN_PROFILE_NOT_FOUND');
  }

  if ([401, 403, 429, 999].includes(response.status)) {
    throw new Error('LINKEDIN_FETCH_BLOCKED');
  }

  if (!response.ok) {
    throw new Error('LINKEDIN_FETCH_FAILED');
  }

  const html = await response.text();
  const metaTitle = extractMetaContent(html, 'og:title') || extractTagTextByClass(html, 'title', '') || '';
  const titleText = metaTitle || (() => {
    const match = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
    return match?.[1] ? stripHtml(match[1]) : '';
  })();
  const titleParts = getTitleParts(titleText);
  const displayName =
    extractTagTextByClass(html, 'h1', 'top-card-layout__title') ||
    extractTagTextByClass(html, 'h1', 'top-card__title') ||
    titleParts.displayName;
  const headline =
    extractTagTextByClass(html, 'h2', 'top-card-layout__headline') ||
    extractTagTextByClass(html, 'h2', 'top-card__headline') ||
    titleParts.headline;
  const location = extractLocation(html);
  const bio = extractSectionText(html, 'About');
  const avatar =
    extractImgSrcByClass(html, 'top-card-layout__entity-image') ||
    extractImgSrcByClass(html, 'top-card__profile-image') ||
    extractMetaContent(html, 'og:image');
  const canonicalUrl = extractMetaContent(html, 'og:url') || buildCanonicalLinkedInUrl(handle);

  return {
    handle,
    canonicalUrl,
    ...(displayName ? { displayName } : {}),
    ...(headline ? { headline } : {}),
    ...(location ? { location } : {}),
    ...(bio && !/^View .* profile on LinkedIn/i.test(bio) ? { bio } : {}),
    ...(avatar ? { avatar } : {}),
    skills: [],
    experience: [],
    education: [],
    certifications: [],
  };
};
