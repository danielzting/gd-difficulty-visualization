import * as d3 from 'd3';
import type { LevelData } from './dataParser';

interface VisualizationConfig {
  container: HTMLElement;
  data: LevelData[];
}

export class GDVisualization {
  private data: LevelData[];
  private container: HTMLElement;
  private svg: d3.Selection<SVGSVGElement, unknown, null, undefined>;
  private chartGroup: d3.Selection<SVGGElement, unknown, null, undefined>;
  private xScale: d3.ScaleBand<string>;
  private yScale: d3.ScaleLinear<number, number>;
  private visibleLevels: number = 1;
  private selectedLevelIndex: number = 0;
  private margin = { top: 20, right: 400, bottom: 130, left: 60 };
  private isMobile: boolean = false;
  private width: number;
  private height: number;
  private detailsPanel: HTMLElement;
  private forwardButton: HTMLElement;
  private backButton: HTMLElement;
  private isResizing: boolean = false;

  constructor(config: VisualizationConfig) {
    this.data = config.data;
    this.container = config.container;
    
    // Check if mobile
    this.updateMobileState();
    
    // Create details panel first (needed for dimension calculation on mobile)
    this.createDetailsPanel();
    
    // Calculate dimensions (after panel is created so we can measure it if needed)
    this.updateDimensions();
    
    // Update container position for mobile layout
    this.updateContainerPosition();
    
    // Create SVG
    this.svg = d3.select(this.container)
      .append('svg')
      .attr('width', this.width + this.margin.left + this.margin.right)
      .attr('height', this.height + this.margin.top + this.margin.bottom);
    
    this.chartGroup = this.svg.append('g')
      .attr('transform', `translate(${this.margin.left},${this.margin.top})`);
    
    // Initialize scales
    this.xScale = d3.scaleBand()
      .domain(this.data.map(d => d.name))
      .range([0, this.width])
      .padding(0.2);
    
    const maxDifficulty = d3.max(this.data, d => d.difficulty) || 1;
    this.yScale = d3.scaleLinear()
      .domain([0, maxDifficulty])
      .range([this.height, 0]);
    
    // Create navigation buttons
    this.createNavigationButtons();
    
    // Initial render
    this.update();
    
    // Handle window resize
    let resizeTimeout: number | null = null;
    window.addEventListener('resize', () => {
      this.updateMobileState();
      this.updateDimensions();
      this.updateDetailsPanelPosition();
      this.updateContainerPosition();
      this.updateNavigationButtonsPosition();
      this.svg
        .attr('width', this.width + this.margin.left + this.margin.right)
        .attr('height', this.height + this.margin.top + this.margin.bottom);
      this.xScale.range([0, this.width]);
      this.yScale.range([this.height, 0]);
      
      // Set resizing flag and update immediately (no transitions)
      this.isResizing = true;
      this.update();
      
      // Clear any existing timeout
      if (resizeTimeout !== null) {
        clearTimeout(resizeTimeout);
      }
      
      // After resize stops, allow transitions again
      resizeTimeout = window.setTimeout(() => {
        this.isResizing = false;
      }, 150);
    });
  }
  
  private updateMobileState(): void {
    this.isMobile = window.innerWidth <= 768;
  }
  
  private updateDimensions(): void {
    if (this.isMobile) {
      // On mobile: full width, height accounts for commentary panel at bottom (50vh) and buttons
      const commentaryHeight = window.innerHeight * 0.5; // 50vh
      const buttonHeight = 60; // Space for buttons
      const availableHeight = window.innerHeight - commentaryHeight - buttonHeight;
      
      // Adjust margins for mobile
      this.margin.right = 20;
      this.margin.left = 20;
      this.margin.bottom = 110;
      this.margin.top = 20;
      
      this.width = window.innerWidth - this.margin.left - this.margin.right;
      this.height = Math.max(200, availableHeight - this.margin.top - this.margin.bottom);
    } else {
      // Desktop: reserve space on right for commentary
      this.margin.right = 400;
      this.margin.left = 60;
      this.margin.bottom = 130;
      this.margin.top = 20;
      
      this.width = window.innerWidth - this.margin.left - this.margin.right;
      this.height = window.innerHeight - this.margin.top - this.margin.bottom;
    }
  }
  
  private updateDetailsPanelPosition(): void {
    if (this.isMobile) {
      // Mobile: position at bottom, full width, 50vh height, with space below for buttons
      this.detailsPanel.style.cssText = `
        position: fixed;
        bottom: 70px;
        left: 0;
        right: 0;
        width: 100vw;
        height: 50vh;
        overflow-y: auto;
        background: white;
        border: none;
        border-top: 2px solid #333;
        border-radius: 0;
        padding: 20px;
        box-shadow: 0 -2px 4px rgba(0,0,0,0.1);
        z-index: 1000;
      `;
    } else {
      // Desktop: position on right, shorter to leave room for buttons below
      this.detailsPanel.style.cssText = `
        position: fixed;
        right: 20px;
        top: 20px;
        width: 360px;
        height: calc(100vh - 100px);
        overflow-y: auto;
        background: white;
        border: 2px solid #333;
        border-radius: 8px;
        padding: 20px;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        z-index: 1000;
      `;
    }
  }
  
  private updateContainerPosition(): void {
    if (this.isMobile) {
      // On mobile, position container at top (commentary is at bottom, 50vh + 60px for buttons)
      this.container.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: calc(100vh - 50vh - 60px);
      `;
    } else {
      // Desktop: normal positioning
      this.container.style.cssText = `
        position: relative;
        width: 100vw;
        height: 100vh;
      `;
    }
  }
  
  private createDetailsPanel(): void {
    this.detailsPanel = document.createElement('div');
    this.detailsPanel.className = 'details-panel';
    this.updateDetailsPanelPosition();
    document.body.appendChild(this.detailsPanel);
  }
  
  private createNavigationButtons(): void {
    const navContainer = document.createElement('div');
    navContainer.className = 'nav-container';
    
    this.backButton = document.createElement('button');
    this.backButton.textContent = '← Back';
    this.backButton.className = 'nav-button';
    this.backButton.style.cssText = `
      padding: 10px 20px;
      font-size: 16px;
      cursor: pointer;
      background: #4CAF50;
      color: white;
      border: none;
      border-radius: 4px;
    `;
    this.backButton.disabled = true;
    this.backButton.addEventListener('click', () => this.goBack());
    
    this.forwardButton = document.createElement('button');
    this.forwardButton.textContent = 'Forward →';
    this.forwardButton.className = 'nav-button';
    this.forwardButton.style.cssText = `
      padding: 10px 20px;
      font-size: 16px;
      cursor: pointer;
      background: #2196F3;
      color: white;
      border: none;
      border-radius: 4px;
    `;
    this.forwardButton.addEventListener('click', () => this.goForward());
    
    navContainer.appendChild(this.backButton);
    navContainer.appendChild(this.forwardButton);
    document.body.appendChild(navContainer);
    
    // Set initial position after adding to DOM
    this.updateNavigationButtonsPosition();
  }
  
  private updateNavigationButtonsPosition(): void {
    const navContainer = document.querySelector('.nav-container') as HTMLElement;
    if (!navContainer) return;
    
    // Preserve disabled state
    const backDisabled = this.backButton.disabled;
    const forwardDisabled = this.forwardButton.disabled;
    
    if (this.isMobile) {
      // Mobile: position at very bottom, centered
      navContainer.style.cssText = `
        position: fixed;
        bottom: 10px;
        left: 50%;
        transform: translateX(-50%);
        display: flex;
        gap: 10px;
        z-index: 1002;
      `;
      // Make buttons wider and equal width on mobile
      this.backButton.style.cssText = `
        padding: 10px 20px;
        font-size: 16px;
        cursor: ${backDisabled ? 'not-allowed' : 'pointer'};
        background: #4CAF50;
        color: white;
        border: none;
        border-radius: 4px;
        min-width: 120px;
        white-space: nowrap;
        opacity: ${backDisabled ? '0.5' : '1'};
      `;
      this.forwardButton.style.cssText = `
        padding: 10px 20px;
        font-size: 16px;
        cursor: ${forwardDisabled ? 'not-allowed' : 'pointer'};
        background: #2196F3;
        color: white;
        border: none;
        border-radius: 4px;
        min-width: 120px;
        white-space: nowrap;
        opacity: ${forwardDisabled ? '0.5' : '1'};
      `;
    } else {
      // Desktop: position at bottom right, below commentary container
      navContainer.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        display: flex;
        gap: 10px;
        z-index: 1001;
      `;
      // Reset button styles for desktop
      this.backButton.style.cssText = `
        padding: 10px 20px;
        font-size: 16px;
        cursor: ${backDisabled ? 'not-allowed' : 'pointer'};
        background: #4CAF50;
        color: white;
        border: none;
        border-radius: 4px;
        opacity: ${backDisabled ? '0.5' : '1'};
      `;
      this.forwardButton.style.cssText = `
        padding: 10px 20px;
        font-size: 16px;
        cursor: ${forwardDisabled ? 'not-allowed' : 'pointer'};
        background: #2196F3;
        color: white;
        border: none;
        border-radius: 4px;
        opacity: ${forwardDisabled ? '0.5' : '1'};
      `;
    }
  }
  
  private goForward(): void {
    if (this.visibleLevels < this.data.length) {
      this.visibleLevels++;
      this.selectedLevelIndex = this.visibleLevels - 1;
      this.update();
      this.updateNavigationButtons();
    }
  }
  
  private goBack(): void {
    if (this.visibleLevels > 1) {
      this.visibleLevels--;
      this.selectedLevelIndex = this.visibleLevels - 1;
      this.update();
      this.updateNavigationButtons();
    }
  }
  
  private updateNavigationButtons(): void {
    this.backButton.disabled = this.visibleLevels <= 1;
    this.forwardButton.disabled = this.visibleLevels >= this.data.length;
    
    if (this.backButton.disabled) {
      (this.backButton as HTMLElement).style.opacity = '0.5';
      (this.backButton as HTMLElement).style.cursor = 'not-allowed';
    } else {
      (this.backButton as HTMLElement).style.opacity = '1';
      (this.backButton as HTMLElement).style.cursor = 'pointer';
    }
    
    if (this.forwardButton.disabled) {
      (this.forwardButton as HTMLElement).style.opacity = '0.5';
      (this.forwardButton as HTMLElement).style.cursor = 'not-allowed';
    } else {
      (this.forwardButton as HTMLElement).style.opacity = '1';
      (this.forwardButton as HTMLElement).style.cursor = 'pointer';
    }
  }
  
  private updateDetailsPanel(level: LevelData): void {
    // Format difficulty value - show decimals if needed
    const difficultyStr = level.difficulty % 1 === 0 
      ? level.difficulty.toLocaleString() 
      : level.difficulty.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 10 });
    
    this.detailsPanel.innerHTML = `
      <h2 style="margin-top: 0; margin-bottom: 10px;">${level.name}</h2>
      ${level.author ? `<p style="color: #666; margin-bottom: 15px;"><strong>Author:</strong> ${level.author}</p>` : ''}
      <p style="font-size: 18px; font-weight: bold; margin-bottom: 15px;">
        Difficulty: ${difficultyStr}
      </p>
      <div style="margin-bottom: 15px;">
        ${level.youtubeUrl ? `<a href="${level.youtubeUrl}" target="_blank" style="display: inline-block; margin-right: 10px; color: #2196F3; text-decoration: none;">📺 YouTube</a>` : ''}
        ${level.gdBrowserUrl ? `<a href="${level.gdBrowserUrl}" target="_blank" style="display: inline-block; color: #2196F3; text-decoration: none;">🎮 GDBrowser</a>` : ''}
      </div>
      ${level.commentary ? `<div style="margin-top: 15px; line-height: 1.6;" class="commentary-content">${level.commentary}</div>` : ''}
    `;
  }
  
  private update(): void {
    const visibleData = this.data.slice(0, this.visibleLevels);
    const maxDifficulty = d3.max(visibleData, d => d.difficulty) || 1;
    
    // Update y-scale to fit visible data
    this.yScale.domain([0, maxDifficulty]);
    
    // Update x-scale to only show visible levels
    this.xScale.domain(visibleData.map(d => d.name));
    
    // Update x-axis (no tick marks)
    const xAxis = d3.axisBottom(this.xScale)
      .tickSize(0)
      .tickFormat(d => {
        const level = visibleData.find(l => l.name === d);
        return level ? level.name : d;
      });
    
    const xAxisGroup = this.chartGroup.selectAll<SVGGElement, unknown>('.x-axis')
      .data([null]);
    
    const xAxisGroupEnter = xAxisGroup.enter()
      .append('g')
      .attr('class', 'x-axis')
      .attr('transform', `translate(0,${this.height})`);
    
    const xAxisGroupMerged = xAxisGroupEnter.merge(xAxisGroup as d3.Selection<SVGGElement, unknown, null, undefined>);
    
    // Update transform to position x-axis at bottom (important for vertical resizing)
    xAxisGroupMerged
      .attr('transform', `translate(0,${this.height})`);
    
    // Update the axis (with or without transition based on resize state)
    if (this.isResizing) {
      xAxisGroupMerged.call(xAxis);
    } else {
      xAxisGroupMerged
        .transition()
        .duration(500)
        .call(xAxis);
    }
    
    // Apply rotation and add hover handlers to all text elements (both new and existing)
    xAxisGroupMerged.selectAll('text')
      .style('text-anchor', 'end')
      .attr('dx', '-.8em')
      .attr('dy', '.15em')
      .attr('transform', 'rotate(-45)')
      .style('cursor', 'pointer')
      .on('click', (event, d) => {
        const level = visibleData.find(l => l.name === d);
        if (level) {
          this.selectedLevelIndex = this.data.indexOf(level);
          this.updateDetailsPanel(level);
        }
      })
      .on('mouseover', (event, d) => {
        const level = visibleData.find(l => l.name === d);
        if (level) {
          // Highlight this label
          d3.select(event.currentTarget as SVGTextElement)
            .style('font-weight', 'bold')
            .style('fill', '#2196F3');
          // Also highlight the corresponding click area
          const levelName = level.name;
          this.chartGroup.selectAll('.click-area')
            .filter((clickData: LevelData) => clickData.name === levelName)
            .style('fill', 'rgba(33, 150, 243, 0.1)');
        }
      })
      .on('mouseout', (event, d) => {
        const level = visibleData.find(l => l.name === d);
        if (level) {
          // Unhighlight this label
          d3.select(event.currentTarget as SVGTextElement)
            .style('font-weight', 'normal')
            .style('fill', '#333');
          // Also unhighlight the corresponding click area
          const levelName = level.name;
          this.chartGroup.selectAll('.click-area')
            .filter((clickData: LevelData) => clickData.name === levelName)
            .style('fill', 'transparent');
        }
      });
    
    // Update y-axis (no ticks or labels)
    const yAxis = d3.axisLeft(this.yScale)
      .tickSize(0)
      .tickFormat('');
    
    const yAxisGroup = this.chartGroup.selectAll<SVGGElement, unknown>('.y-axis')
      .data([null]);
    
    const yAxisGroupEnter = yAxisGroup.enter()
      .append('g')
      .attr('class', 'y-axis');
    
    const yAxisGroupMerged = yAxisGroupEnter.merge(yAxisGroup as d3.Selection<SVGGElement, unknown, null, undefined>);
    
    if (this.isResizing) {
      yAxisGroupMerged.call(yAxis);
    } else {
      yAxisGroupMerged
        .transition()
        .duration(500)
        .call(yAxis);
    }
    
    // Update bars
    const bars = this.chartGroup.selectAll<SVGRectElement, LevelData>('.bar')
      .data(visibleData, d => d.name);
    
    // Remove bars that are no longer visible
    const barsExit = bars.exit();
    if (this.isResizing) {
      barsExit
        .attr('height', 0)
        .attr('y', this.height)
        .remove();
    } else {
      barsExit
        .transition()
        .duration(500)
        .attr('height', 0)
        .attr('y', this.height)
        .remove();
    }
    
    // Add invisible clickable rectangles that extend to the top
    const clickAreas = this.chartGroup.selectAll<SVGRectElement, LevelData>('.click-area')
      .data(visibleData, d => d.name);
    
    clickAreas.exit().remove();
    
    const clickAreasEnter = clickAreas.enter()
      .append('rect')
      .attr('class', 'click-area')
      .attr('x', d => this.xScale(d.name) || 0)
      .attr('width', this.xScale.bandwidth())
      .attr('y', 0)
      .attr('height', this.height)
      .style('fill', 'transparent')
      .style('cursor', 'pointer')
      .on('click', (event, d) => {
        this.selectedLevelIndex = this.data.indexOf(d);
        this.updateDetailsPanel(d);
      })
      .on('mouseover', (event, d) => {
        // Highlight x-axis label
        const levelName = d.name;
        this.chartGroup.selectAll('.x-axis text')
          .each(function() {
            if (d3.select(this).text() === levelName) {
              d3.select(this)
                .style('font-weight', 'bold')
                .style('fill', '#2196F3');
            }
          });
        // Highlight click area
        d3.select(event.currentTarget as SVGRectElement)
          .style('fill', 'rgba(33, 150, 243, 0.1)');
      })
      .on('mouseout', (event, d) => {
        // Unhighlight x-axis label
        const levelName = d.name;
        this.chartGroup.selectAll('.x-axis text')
          .each(function() {
            if (d3.select(this).text() === levelName) {
              d3.select(this)
                .style('font-weight', 'normal')
                .style('fill', '#333');
            }
          });
        // Unhighlight click area
        d3.select(event.currentTarget as SVGRectElement)
          .style('fill', 'transparent');
      });
    
    const clickAreasMerged = clickAreasEnter.merge(clickAreas as d3.Selection<SVGRectElement, LevelData, SVGGElement, unknown>);
    
    if (this.isResizing) {
      clickAreasMerged
        .attr('x', d => this.xScale(d.name) || 0)
        .attr('width', this.xScale.bandwidth())
        .attr('height', this.height);
    } else {
      clickAreasMerged
        .transition()
        .duration(500)
        .attr('x', d => this.xScale(d.name) || 0)
        .attr('width', this.xScale.bandwidth())
        .attr('height', this.height);
    }
    
    // Add new bars
    const barsEnter = bars.enter()
      .append('rect')
      .attr('class', 'bar')
      .attr('x', d => this.xScale(d.name) || 0)
      .attr('width', this.xScale.bandwidth())
      .attr('y', this.height)
      .attr('height', 0)
      .style('fill', '#2196F3')
      .style('pointer-events', 'none'); // Let click areas handle interactions
    
    // Update existing and new bars
    const barsMerged = barsEnter.merge(bars as d3.Selection<SVGRectElement, LevelData, SVGGElement, unknown>);
    
    if (this.isResizing) {
      barsMerged
        .attr('x', d => this.xScale(d.name) || 0)
        .attr('width', this.xScale.bandwidth())
        .attr('y', d => this.yScale(d.difficulty))
        .attr('height', d => this.height - this.yScale(d.difficulty));
    } else {
      barsMerged
        .transition()
        .duration(500)
        .attr('x', d => this.xScale(d.name) || 0)
        .attr('width', this.xScale.bandwidth())
        .attr('y', d => this.yScale(d.difficulty))
        .attr('height', d => this.height - this.yScale(d.difficulty));
    }
    
    // Update details panel with selected level
    if (this.selectedLevelIndex < this.data.length) {
      this.updateDetailsPanel(this.data[this.selectedLevelIndex]);
    }
    
    this.updateNavigationButtons();
  }
}

