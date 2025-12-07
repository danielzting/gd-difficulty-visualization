import { fetchAndParseLevelData } from './dataParser';
import { GDVisualization } from './visualization';
import './style.css';

async function init() {
  try {
    const app = document.querySelector<HTMLDivElement>('#app');
    if (!app) {
      throw new Error('App container not found');
    }
    
    // Fetch and parse level data
    const levelData = await fetchAndParseLevelData();
    
    if (levelData.length === 0) {
      app.innerHTML = '<p>No level data found. Please check the blog post URL.</p>';
      return;
    }
    
    // Initialize visualization
    new GDVisualization({
      container: app,
      data: levelData
    });
    
  } catch (error) {
    const app = document.querySelector<HTMLDivElement>('#app');
    if (app) {
      app.innerHTML = `
        <div style="padding: 20px; color: red;">
          <h2>Error loading visualization</h2>
          <p>${error instanceof Error ? error.message : 'Unknown error occurred'}</p>
          <p>Please ensure the blog post is accessible at the configured URL.</p>
        </div>
      `;
    }
    console.error('Failed to initialize visualization:', error);
  }
}

init();

