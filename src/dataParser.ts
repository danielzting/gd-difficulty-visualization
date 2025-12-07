export const BLOG_POST_URL = 'http://localhost:4321/blog/why-geometry-dash-is-the-worlds-hardest-game';

export interface LevelData {
  name: string;
  author: string;
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
    const levelNameAndAuthor = h3.textContent?.trim() || '';
    
    // Parse name and author from h3 (format may vary, assuming "Level Name by Author" or similar)
    const nameAuthorMatch = levelNameAndAuthor.match(/^(.+?)(?:\s+by\s+|\s+-\s+)(.+)$/i);
    const name = nameAuthorMatch ? nameAuthorMatch[1].trim() : levelNameAndAuthor;
    const author = nameAuthorMatch ? nameAuthorMatch[2].trim() : '';
    
    // Find the next h3 to know where to stop
    const nextH3 = i < h3Elements.length - 1 ? h3Elements[i + 1] : null;
    
    // Collect all content between this h3 and the next h3
    let currentElement: Node | null = h3.nextSibling;
    const allContent: Element[] = [];
    
    while (currentElement) {
      if (currentElement.nodeType === Node.ELEMENT_NODE) {
        const element = currentElement as Element;
        if (element === nextH3) {
          break;
        }
        allContent.push(element);
      }
      currentElement = currentElement.nextSibling;
    }
    
    // Find difficulty value (supports decimals)
    let difficulty: number | null = null;
    for (const element of allContent) {
      const text = element.textContent || '';
      const difficultyMatch = text.match(/Difficulty\s+value:\s*([\d,.]+)/i);
      if (difficultyMatch) {
        difficulty = parseFloat(difficultyMatch[1].replace(/,/g, ''));
        break;
      }
    }
    
    if (difficulty === null) {
      continue; // Skip if no difficulty found
    }
    
    // Find YouTube and GDBrowser links
    let youtubeUrl: string | null = null;
    let gdBrowserUrl: string | null = null;
    let linksFound = false;
    
    for (const element of allContent) {
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
    const commentaryElements: Element[] = [];
    for (let j = commentaryStartIndex; j < allContent.length; j++) {
      const element = allContent[j];
      const text = element.textContent?.trim();
      if (text && !text.match(/Difficulty\s+value:/i)) {
        // Clone element and remove YouTube/GDBrowser links (keep other links)
        const clone = element.cloneNode(true) as Element;
        const links = clone.querySelectorAll('a');
        links.forEach(link => {
          const href = link.getAttribute('href') || '';
          if (href.includes('youtube.com') || href.includes('youtu.be') || 
              href.includes('gdbrowser.com')) {
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
      author,
      difficulty,
      youtubeUrl,
      gdBrowserUrl,
      commentary: commentaryHTML
    });
  }
  
  return levels;
}
