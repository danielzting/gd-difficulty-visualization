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
  private margin = { top: 20, right: 400, bottom: 100, left: 60 };
  private width: number;
  private height: number;
  private detailsPanel: HTMLElement;
  private forwardButton: HTMLElement;
  private backButton: HTMLElement;

  constructor(config: VisualizationConfig) {
    this.data = config.data;
    this.container = config.container;
    
    // Calculate dimensions
    this.width = window.innerWidth - this.margin.left - this.margin.right;
    this.height = window.innerHeight - this.margin.top - this.margin.bottom;
    
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
    
    // Create details panel
    this.createDetailsPanel();
    
    // Create navigation buttons
    this.createNavigationButtons();
    
    // Initial render
    this.update();
    
    // Handle window resize
    window.addEventListener('resize', () => {
      this.width = window.innerWidth - this.margin.left - this.margin.right;
      this.height = window.innerHeight - this.margin.top - this.margin.bottom;
      this.svg
        .attr('width', this.width + this.margin.left + this.margin.right)
        .attr('height', this.height + this.margin.top + this.margin.bottom);
      this.xScale.range([0, this.width]);
      this.yScale.range([this.height, 0]);
      this.update();
    });
  }
  
  private createDetailsPanel(): void {
    this.detailsPanel = document.createElement('div');
    this.detailsPanel.className = 'details-panel';
    this.detailsPanel.style.cssText = `
      position: fixed;
      right: 20px;
      top: 20px;
      width: 360px;
      max-height: calc(100vh - 40px);
      overflow-y: auto;
      background: white;
      border: 2px solid #333;
      border-radius: 8px;
      padding: 20px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
      z-index: 1000;
    `;
    document.body.appendChild(this.detailsPanel);
  }
  
  private createNavigationButtons(): void {
    const navContainer = document.createElement('div');
    navContainer.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      display: flex;
      gap: 10px;
      z-index: 1001;
    `;
    
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
    this.detailsPanel.innerHTML = `
      <h2 style="margin-top: 0; margin-bottom: 10px;">${level.name}</h2>
      ${level.author ? `<p style="color: #666; margin-bottom: 15px;"><strong>Author:</strong> ${level.author}</p>` : ''}
      <p style="font-size: 18px; font-weight: bold; margin-bottom: 15px;">
        Difficulty: ${level.difficulty.toLocaleString()}
      </p>
      <div style="margin-bottom: 15px;">
        ${level.youtubeUrl ? `<a href="${level.youtubeUrl}" target="_blank" style="display: inline-block; margin-right: 10px; color: #2196F3; text-decoration: none;">📺 YouTube</a>` : ''}
        ${level.gdBrowserUrl ? `<a href="${level.gdBrowserUrl}" target="_blank" style="display: inline-block; color: #2196F3; text-decoration: none;">🎮 GDBrowser</a>` : ''}
      </div>
      ${level.commentary ? `<div style="margin-top: 15px; line-height: 1.6;">${level.commentary}</div>` : ''}
    `;
  }
  
  private update(): void {
    const visibleData = this.data.slice(0, this.visibleLevels);
    const maxDifficulty = d3.max(visibleData, d => d.difficulty) || 1;
    
    // Update y-scale to fit visible data
    this.yScale.domain([0, maxDifficulty]);
    
    // Update x-scale to only show visible levels
    this.xScale.domain(visibleData.map(d => d.name));
    
    // Update x-axis
    const xAxis = d3.axisBottom(this.xScale)
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
    
    xAxisGroupMerged
      .transition()
      .duration(500)
      .call(xAxis);
    
    // Apply rotation to all text elements (both new and existing)
    xAxisGroupMerged.selectAll('text')
      .style('text-anchor', 'end')
      .attr('dx', '-.8em')
      .attr('dy', '.15em')
      .attr('transform', 'rotate(-45)');
    
    // Update y-axis (no label)
    const yAxis = d3.axisLeft(this.yScale);
    
    const yAxisGroup = this.chartGroup.selectAll<SVGGElement, unknown>('.y-axis')
      .data([null]);
    
    const yAxisGroupEnter = yAxisGroup.enter()
      .append('g')
      .attr('class', 'y-axis');
    
    yAxisGroupEnter.merge(yAxisGroup as d3.Selection<SVGGElement, unknown, null, undefined>)
      .transition()
      .duration(500)
      .call(yAxis);
    
    // Update bars
    const bars = this.chartGroup.selectAll<SVGRectElement, LevelData>('.bar')
      .data(visibleData, d => d.name);
    
    // Remove bars that are no longer visible
    bars.exit()
      .transition()
      .duration(500)
      .attr('height', 0)
      .attr('y', this.height)
      .remove();
    
    // Add new bars
    const barsEnter = bars.enter()
      .append('rect')
      .attr('class', 'bar')
      .attr('x', d => this.xScale(d.name) || 0)
      .attr('width', this.xScale.bandwidth())
      .attr('y', this.height)
      .attr('height', 0)
      .style('fill', '#2196F3')
      .style('cursor', 'pointer')
      .on('click', (event, d) => {
        this.selectedLevelIndex = this.data.indexOf(d);
        this.updateDetailsPanel(d);
      })
      .on('mouseover', function() {
        d3.select(this).style('fill', '#1976D2');
      })
      .on('mouseout', function() {
        d3.select(this).style('fill', '#2196F3');
      });
    
    // Update existing and new bars
    barsEnter.merge(bars as d3.Selection<SVGRectElement, LevelData, SVGGElement, unknown>)
      .transition()
      .duration(500)
      .attr('x', d => this.xScale(d.name) || 0)
      .attr('width', this.xScale.bandwidth())
      .attr('y', d => this.yScale(d.difficulty))
      .attr('height', d => this.height - this.yScale(d.difficulty));
    
    // Update details panel with selected level
    if (this.selectedLevelIndex < this.data.length) {
      this.updateDetailsPanel(this.data[this.selectedLevelIndex]);
    }
    
    this.updateNavigationButtons();
  }
}

