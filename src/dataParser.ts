export const BLOG_POST_URL = 'https://danielzting.github.io/blog/the-inhuman-skill-ceiling-of-geometry-dash/';

export interface LevelData {
  name: string;
  publisher: string;
  difficulty: number;
  youtubeUrl: string | null;
  gdBrowserUrl: string | null;
  commentary: string;
}

export async function fetchAndParseLevelData(): Promise<LevelData[]> {
  const response = await fetch(BLOG_POST_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch blog post: ${response.statusText}`);
  }

  const html = await response.text();
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  const levels: LevelData[] = [];
  const h3Elements = doc.querySelectorAll('h3');

  for (let i = 0; i < h3Elements.length; i++) {
    const h3 = h3Elements[i];
    const levelNameAndPublisher = h3.textContent?.trim() || '';

    // Parse name and publisher from h3 (format may vary, assuming "Level Name by Publisher" or similar)
    const namePublisherMatch = levelNameAndPublisher.match(/^(.+?)(?:\s+by\s+|\s+-\s+)(.+)$/i);
    const name = namePublisherMatch ? namePublisherMatch[1].trim() : levelNameAndPublisher;
    const publisher = namePublisherMatch ? namePublisherMatch[2].trim() : '';

    // Find the next h3 to know where to stop (for finding next level)
    const nextH3 = i < h3Elements.length - 1 ? h3Elements[i + 1] : null;

    // Collect all content between this h3 and the next heading (any h1-h6)
    let currentElement: Node | null = h3.nextSibling;
    const allContent: Element[] = [];

    while (currentElement) {
      if (currentElement.nodeType === Node.ELEMENT_NODE) {
        const element = currentElement as Element;
        // Stop at next h3 (next level) or any other heading tag
        if (element === nextH3 || /^H[1-6]$/.test(element.tagName)) {
          break;
        }
        allContent.push(element);
      }
      currentElement = currentElement.nextSibling;
    }

    // Find difficulty value (supports decimals)
    let difficulty: number | null = null;
    let difficultyElementIndex: number = -1;
    for (const element of allContent) {
      const text = element.textContent || '';
      const difficultyMatch = text.match(/Difficulty\s+value:\s*([\d,.]+)/i);
      if (difficultyMatch) {
        difficulty = parseFloat(difficultyMatch[1].replace(/,/g, ''));
        difficultyElementIndex = allContent.indexOf(element);
        break;
      }
    }

    if (difficulty === null) {
      continue; // Skip if no difficulty found
    }

    // Find YouTube and GDBrowser links. Also collect hrefs from the difficulty element
    // so we only remove those specific anchors from commentary (preserve other anchors).
    let youtubeUrl: string | null = null;
    let gdBrowserUrl: string | null = null;
    let linksFound = false;
    const excludedHrefs = new Set<string>();

    for (let idx = 0; idx < allContent.length; idx++) {
      const element = allContent[idx];
      const links = element.querySelectorAll('a');
      for (const link of links) {
        const href = link.getAttribute('href') || '';
        const linkText = link.textContent?.toLowerCase() || '';

        if (href.includes('youtube.com') || href.includes('youtu.be') || linkText.includes('youtube')) {
          youtubeUrl = href;
          linksFound = true;
        } else if (href.includes('gdbrowser.com') || linkText.includes('gdbrowser')) {
          gdBrowserUrl = href;
          linksFound = true;
        }

        // If this link is inside the same element that contained the difficulty value,
        // mark it for exclusion from the commentary HTML so we don't duplicate it there.
        if (idx === difficultyElementIndex && href) {
          excludedHrefs.add(href);
        }
      }
      if (linksFound) {
        break;
      }
    }

    // Collect commentary: everything after the links (or after difficulty if no links)
    // Find the index where links end (or where difficulty ends)
    let commentaryStartIndex = 0;
    let foundDifficulty = false;
    let foundLinks = false;

    for (let j = 0; j < allContent.length; j++) {
      const element = allContent[j];
      const text = element.textContent || '';

      if (!foundDifficulty && text.match(/Difficulty\s+value:/i)) {
        foundDifficulty = true;
        commentaryStartIndex = j + 1;
      }

      if (foundDifficulty && !foundLinks) {
        const links = element.querySelectorAll('a');
        if (links.length > 0) {
          for (const link of links) {
            const href = link.getAttribute('href') || '';
            if (href.includes('youtube.com') || href.includes('youtu.be') ||
              href.includes('gdbrowser.com')) {
              foundLinks = true;
              commentaryStartIndex = j + 1;
              break;
            }
          }
        }
      }
    }

    // Collect commentary from commentaryStartIndex onwards (preserve HTML)
    // Stop at any heading tag (h1-h6)
    const commentaryElements: Element[] = [];
    for (let j = commentaryStartIndex; j < allContent.length; j++) {
      const element = allContent[j];

      // Stop if we encounter any heading tag
      if (/^H[1-6]$/.test(element.tagName)) {
        break;
      }

      const text = element.textContent?.trim();
      if (text && !text.match(/Difficulty\s+value:/i)) {
        // Clone element and remove YouTube/GDBrowser links (keep other links)
        const clone = element.cloneNode(true) as Element;
        const links = clone.querySelectorAll('a');
        links.forEach(link => {
          const href = link.getAttribute('href') || '';
          // Remove only those anchors that were part of the difficulty line (we collected them).
          if (href && excludedHrefs.has(href)) {
            link.remove();
          }
        });
        // Only add if there's still content after removing those links
        if (clone.textContent?.trim() || clone.querySelector('img, blockquote, ul, ol')) {
          commentaryElements.push(clone);
        }
      }
    }

    // Convert commentary elements to HTML string
    const commentaryHTML = commentaryElements.map(el => el.outerHTML).join('');

    levels.push({
      name,
      publisher,
      difficulty,
      youtubeUrl,
      gdBrowserUrl,
      commentary: commentaryHTML
    });
  }

  return levels;
}
