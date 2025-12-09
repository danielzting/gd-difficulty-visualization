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
  private margin = { top: 20, right: 400, bottom: 145, left: 60 };
  private isMobile: boolean = false;
  private width: number;
  private height: number;
  private detailsPanel: HTMLElement;
  private forwardButton: HTMLElement;
  private backButton: HTMLElement;
  private isResizing: boolean = false;
  private isSelecting: boolean = false;
  private longPressTimer: number | null = null;
  private selectionLine: d3.Selection<SVGLineElement, unknown, null, undefined> | null = null;

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

    // Add a selection line (hidden by default)
    this.selectionLine = this.chartGroup.append('line')
      .attr('class', 'selection-line')
      .attr('y1', 0)
      .attr('y2', this.height)
      .attr('x1', 0)
      .attr('x2', 0)
      .style('stroke', 'var(--selection)')
      .style('stroke-width', '2px')
      .style('pointer-events', 'none')
      .style('display', 'none');

    // Setup touch / mouse handlers for hold-and-swipe selection
    this.setupTouchHandlers();

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
      // On mobile: full width, height accounts for commentary panel at bottom (55vh) and buttons
      const commentaryHeight = window.innerHeight * 0.55; // 55vh (use freed-up label space)
      const buttonHeight = 60; // Space for buttons
      const availableHeight = window.innerHeight - commentaryHeight - buttonHeight;

      // Adjust margins for mobile
      this.margin.right = 20;
      this.margin.left = 20;
      // Reduce bottom margin because x-axis labels are hidden on mobile
      this.margin.bottom = 60;
      this.margin.top = 20;

      this.width = window.innerWidth - this.margin.left - this.margin.right;
      this.height = Math.max(200, availableHeight - this.margin.top - this.margin.bottom);
    } else {
      // Desktop: reserve space on right for commentary
      this.margin.right = 400;
      this.margin.left = 60;
      this.margin.bottom = 145;
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
        height: 55vh;
        overflow-y: auto;
        background: var(--panel-bg);
        border: none;
        border-top: 2px solid var(--panel-border);
        border-radius: 0;
        padding: 20px;
        box-shadow: 0 -2px 8px rgba(0,0,0,0.6);
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
        background: var(--panel-bg);
        border: 2px solid var(--panel-border);
        border-radius: 8px;
        padding: 20px;
        box-shadow: 0 6px 18px rgba(0,0,0,0.6);
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
        height: calc(100vh - 55vh - 60px);
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
      background: var(--btn-back);
      color: var(--btn-text);
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
      background: var(--btn-forward);
      color: var(--btn-text);
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
        background: var(--btn-back);
        color: var(--btn-text);
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
        background: var(--btn-forward);
        color: var(--btn-text);
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
        background: var(--btn-back);
        color: var(--btn-text);
        border: none;
        border-radius: 4px;
        opacity: ${backDisabled ? '0.5' : '1'};
      `;
      this.forwardButton.style.cssText = `
        padding: 10px 20px;
        font-size: 16px;
        cursor: ${forwardDisabled ? 'not-allowed' : 'pointer'};
        background: var(--btn-forward);
        color: var(--btn-text);
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

  private clientXToChartX(clientX: number): number {
    const svgEl = this.svg.node() as SVGSVGElement;
    const rect = svgEl.getBoundingClientRect();
    return clientX - rect.left - this.margin.left;
  }

  private xToNearestIndex(x: number): number {
    const visibleData = this.data.slice(0, this.visibleLevels);
    const bw = this.xScale.bandwidth();
    let nearest = 0;
    let minDist = Infinity;
    visibleData.forEach((d, i) => {
      const start = (this.xScale(d.name) || 0) + bw / 2;
      const dist = Math.abs(start - x);
      if (dist < minDist) {
        minDist = dist;
        nearest = this.data.indexOf(d);
      }
    });
    return nearest;
  }

  private setupTouchHandlers(): void {
    const svgEl = this.svg.node();
    if (!svgEl) return;

    let activeTouchId: number | null = null;

    const startPress = (clientX: number) => {
      // Start a short long-press timer to enter selection mode
      if (this.longPressTimer) window.clearTimeout(this.longPressTimer);
      this.longPressTimer = window.setTimeout(() => {
        this.isSelecting = true;
        const x = this.clientXToChartX(clientX);
        if (this.selectionLine) {
          this.selectionLine
            .attr('x1', x)
            .attr('x2', x)
            .attr('y2', this.height)
            .style('display', null);
        }
        const idx = this.xToNearestIndex(x);
        this.selectedLevelIndex = idx;
        this.updateDetailsPanel(this.data[this.selectedLevelIndex]);
        // Highlight the related click area visually
        this.chartGroup.selectAll('.click-area')
          .style('fill', (d: LevelData, i: number) => this.data.indexOf(d) === idx ? 'rgba(255,87,34,0.12)' : 'transparent');
      }, 180);
    };

    const movePress = (clientX: number) => {
      if (!this.isSelecting) return;
      const x = this.clientXToChartX(clientX);
      if (this.selectionLine) {
        this.selectionLine
          .attr('x1', x)
          .attr('x2', x);
      }
      const idx = this.xToNearestIndex(x);
      if (idx !== this.selectedLevelIndex) {
        this.selectedLevelIndex = idx;
        this.updateDetailsPanel(this.data[this.selectedLevelIndex]);
        this.chartGroup.selectAll('.click-area')
          .style('fill', (d: LevelData) => this.data.indexOf(d) === idx ? 'rgba(255,87,34,0.12)' : 'transparent');
      }
    };

    const endPress = () => {
      if (this.longPressTimer) {
        window.clearTimeout(this.longPressTimer);
        this.longPressTimer = null;
      }
      if (this.isSelecting) {
        this.isSelecting = false;
        if (this.selectionLine) this.selectionLine.style('display', 'none');
        this.chartGroup.selectAll('.click-area').style('fill', 'transparent');
      }
    };

    // Touch events
    svgEl.addEventListener('touchstart', (ev: TouchEvent) => {
      if (ev.touches.length === 0) return;
      const t = ev.touches[0];
      activeTouchId = t.identifier;
      startPress(t.clientX);
    }, { passive: true });

    svgEl.addEventListener('touchmove', (ev: TouchEvent) => {
      if (activeTouchId === null) return;
      for (let i = 0; i < ev.touches.length; i++) {
        const t = ev.touches[i];
        if (t.identifier === activeTouchId) {
          // If moved significantly before long-press triggers, cancel long-press
          if (!this.isSelecting && this.longPressTimer) {
            // small movement threshold
            // We'll just cancel if movement detected
            window.clearTimeout(this.longPressTimer);
            this.longPressTimer = null;
          }
          movePress(t.clientX);
          break;
        }
      }
    }, { passive: true });

    svgEl.addEventListener('touchend', (ev: TouchEvent) => {
      activeTouchId = null;
      endPress();
    });

    svgEl.addEventListener('touchcancel', () => {
      activeTouchId = null;
      endPress();
    });

    // Mouse events (desktop) — allow click-and-drag selection when pressing mouse
    let mouseDown = false;
    svgEl.addEventListener('mousedown', (ev: MouseEvent) => {
      mouseDown = true;
      startPress(ev.clientX);
    });

    window.addEventListener('mousemove', (ev: MouseEvent) => {
      if (!mouseDown) return;
      movePress(ev.clientX);
    });

    window.addEventListener('mouseup', () => {
      if (mouseDown) {
        mouseDown = false;
        endPress();
      }
    });
  }

  private updateDetailsPanel(level: LevelData): void {
    // Format difficulty value - show decimals if needed
    const difficultyStr = level.difficulty % 1 === 0
      ? level.difficulty.toLocaleString()
      : level.difficulty.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 10 });

    this.detailsPanel.innerHTML = `
      <h2 style="margin-top: 0; margin-bottom: 10px;">${level.name}</h2>
      ${level.author ? `<p style="color: var(--muted); margin-bottom: 15px;"><strong>Author:</strong> ${level.author}</p>` : ''}
      <p style="font-size: 18px; font-weight: bold; margin-bottom: 15px; color: var(--text);">
        Difficulty: ${difficultyStr}
      </p>
      <div style="margin-bottom: 15px;">
        ${level.youtubeUrl ? `<a href="${level.youtubeUrl}" target="_blank" style="display: inline-block; margin-right: 10px; color: var(--accent); text-decoration: none;">📺 YouTube</a>` : ''}
        ${level.gdBrowserUrl ? `<a href="${level.gdBrowserUrl}" target="_blank" style="display: inline-block; color: var(--accent); text-decoration: none;">🎮 GDBrowser</a>` : ''}
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

    // On mobile we don't want x-axis labels — hide them completely
    xAxisGroupMerged.selectAll('text')
      .style('display', this.isMobile ? 'none' : null);

    // Apply rotation and add hover handlers to all text elements (both new and existing)
    xAxisGroupMerged.selectAll('text')
      .style('text-anchor', 'end')
      .attr('dx', '-.5em')
      .attr('dy', '.35em')
      .attr('transform', 'rotate(-90)')
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
            .style('fill', 'var(--accent)');
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
            .style('fill', 'var(--text)');
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
          .each(function () {
            if (d3.select(this).text() === levelName) {
              d3.select(this)
                .style('font-weight', 'bold')
                .style('fill', 'var(--accent)');
            }
          });
        // Highlight click area
        d3.select(event.currentTarget as SVGRectElement)
          .style('fill', 'var(--hover-bg)');
      })
      .on('mouseout', (event, d) => {
        // Unhighlight x-axis label
        const levelName = d.name;
        this.chartGroup.selectAll('.x-axis text')
          .each(function () {
            if (d3.select(this).text() === levelName) {
              d3.select(this)
                .style('font-weight', 'normal')
                .style('fill', 'var(--text)');
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
      .style('fill', 'var(--bar)')
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

    // Ensure selection line height matches current chart height
    if (this.selectionLine) {
      this.selectionLine.attr('y2', this.height);
      if (!this.isSelecting) this.selectionLine.style('display', 'none');
    }
  }
}
