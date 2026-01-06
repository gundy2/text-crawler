/**
 * Text Renderer with Knuth-Plass Justification
 * Uses opentype.js for precise font metrics
 */

import { KnuthPlassJustifier } from './knuth-plass.js';

export class TextRenderer {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.canvasWidth = options.canvasWidth || 2048;
    this.opentypeFont = null;
    this.fallbackFont = 'sans-serif';
    this.justifier = null;
  }

  setFont(opentypeFont) {
    this.opentypeFont = opentypeFont;
  }

  initJustifier(options = {}) {
    this.justifier = new KnuthPlassJustifier({
      tolerance: options.tolerance || 2,
      hyphenPenalty: options.hyphenPenalty || 50,
      linePenalty: options.linePenalty || 10
    });
  }

  measureText(text, fontSize) {
    if (!this.opentypeFont) {
      this.ctx.font = `${fontSize}px ${this.fallbackFont}`;
      return this.ctx.measureText(text).width;
    }

    const scale = fontSize / this.opentypeFont.unitsPerEm;
    let width = 0;

    for (let char of text) {
      const glyph = this.opentypeFont.charToGlyph(char);
      if (glyph && glyph.advanceWidth) {
        width += glyph.advanceWidth * scale;
      }
    }

    return width;
  }

  getSpaceWidth(fontSize) {
    return this.measureText(' ', fontSize);
  }

  /**
   * Simple justified text without Knuth-Plass for more reliable rendering
   */
  renderSimpleJustified(text, x, y, columnWidth, fontSize, lineHeight) {
    const words = text.trim().split(/\s+/);
    const spaceWidth = this.getSpaceWidth(fontSize);
    const fontName = this.opentypeFont ? 'Pathway Gothic One' : this.fallbackFont;
    
    this.ctx.font = `${fontSize}px ${fontName}`;
    this.ctx.fillStyle = '#ffe81f';
    this.ctx.textBaseline = 'top';
    
    let currentLine = [];
    let currentWidth = 0;
    let currentY = y;
    
    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      const wordWidth = this.measureText(word, fontSize);
      const testWidth = currentWidth + (currentLine.length > 0 ? spaceWidth : 0) + wordWidth;
      
      if (testWidth > columnWidth && currentLine.length > 0) {
        // Render current line with justification
        this.renderJustifiedLine(currentLine, x, currentY, columnWidth, fontSize, spaceWidth);
        currentY += lineHeight;
        currentLine = [word];
        currentWidth = wordWidth;
      } else {
        currentLine.push(word);
        currentWidth = testWidth;
      }
    }
    
    // Render last line (left-aligned, not justified)
    if (currentLine.length > 0) {
      let currentX = x;
      for (let i = 0; i < currentLine.length; i++) {
        this.ctx.fillText(currentLine[i], currentX, currentY);
        currentX += this.measureText(currentLine[i], fontSize);
        if (i < currentLine.length - 1) {
          currentX += spaceWidth;
        }
      }
      currentY += lineHeight;
    }
    
    return currentY;
  }

  renderJustifiedLine(words, x, y, columnWidth, fontSize, normalSpaceWidth) {
    if (words.length <= 1) {
      // Single word - just render it
      this.ctx.fillText(words[0], x, y);
      return;
    }
    
    // Calculate total word width
    let totalWordWidth = 0;
    for (let word of words) {
      totalWordWidth += this.measureText(word, fontSize);
    }
    
    // Calculate justified space width
    const totalSpaceNeeded = columnWidth - totalWordWidth;
    const numSpaces = words.length - 1;
    const spaceWidth = totalSpaceNeeded / numSpaces;
    
    // Render words with calculated spacing
    let currentX = x;
    for (let i = 0; i < words.length; i++) {
      this.ctx.fillText(words[i], currentX, y);
      currentX += this.measureText(words[i], fontSize);
      if (i < words.length - 1) {
        currentX += spaceWidth;
      }
    }
  }

  /**
   * Render text with Knuth-Plass justification
   */
  renderKnuthPlassJustified(text, x, y, columnWidth, fontSize, lineHeight) {
    if (!this.justifier) {
      this.initJustifier();
    }

    const words = text.trim().split(/\s+/);
    const spaceWidth = this.getSpaceWidth(fontSize);
    
    try {
      // Create items for Knuth-Plass algorithm
      const items = this.justifier.createItemsFromText(
        words,
        fontSize,
        this.opentypeFont,
        spaceWidth
      );

      // Create line widths array
      const lineWidths = new Array(words.length).fill(columnWidth);

      // Compute sums for adjustment calculations
      const sumWidth = this.justifier.computeSums(items);

      // Break into lines
      const breakpoints = this.justifier.breakLines(items, lineWidths);

      // Format and render lines
      const lines = this.justifier.formatJustifiedLines(items, breakpoints, lineWidths, sumWidth);

      const fontName = this.opentypeFont ? 'Pathway Gothic One' : this.fallbackFont;
      this.ctx.font = `${fontSize}px ${fontName}`;
      this.ctx.fillStyle = '#ffe81f';
      this.ctx.textBaseline = 'top';

      let currentY = y;

      for (let line of lines) {
        this.renderKnuthPlassLine(line, x, currentY);
        currentY += lineHeight;
      }

      return currentY;
    } catch (error) {
      console.warn('Knuth-Plass failed, falling back to simple justification:', error);
      return this.renderSimpleJustified(text, x, y, columnWidth, fontSize, lineHeight);
    }
  }

  renderKnuthPlassLine(line, x, y) {
    const { items, ratio } = line;
    
    let currentX = x;

    for (let item of items) {
      if (item.type === 'box') {
        this.ctx.fillText(item.value, currentX, y);
        currentX += item.width;
      } else if (item.type === 'glue') {
        // Adjust space width based on ratio
        let adjustedWidth = item.width;
        
        if (ratio > 0 && ratio < 10) {
          // Stretch
          adjustedWidth += item.stretch * ratio;
        } else if (ratio < 0 && ratio > -1) {
          // Shrink
          adjustedWidth += item.shrink * ratio;
        }
        
        currentX += adjustedWidth;
      }
    }
  }

  /**
   * Render centered text (for titles)
   */
  renderCenteredText(text, y, fontSize) {
    const fontName = this.opentypeFont ? 'Pathway Gothic One' : this.fallbackFont;
    this.ctx.font = `bold ${fontSize}px PathwayGothic, sans-serif`;
    this.ctx.fillStyle = '#ffe81f';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'top';
    
    this.ctx.fillText(text, this.canvasWidth / 2, y);
    
    this.ctx.textAlign = 'left';
  }

  /**
   * Simple word wrapping without justification
   */
  wrapText(text, maxWidth, fontSize) {
    const fontName = this.opentypeFont ? 'Pathway Gothic One' : this.fallbackFont;
    this.ctx.font = `${fontSize}px ${fontName}`;
    
    const words = text.split(' ');
    const lines = [];
    let currentLine = '';

    for (let word of words) {
      const testLine = currentLine + (currentLine ? ' ' : '') + word;
      const width = this.measureText(testLine, fontSize);

      if (width > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }

    if (currentLine) lines.push(currentLine);
    return lines;
  }

  renderSimpleWrapped(text, x, y, columnWidth, fontSize, lineHeight) {
    const lines = this.wrapText(text, columnWidth, fontSize);
    const fontName = this.opentypeFont ? 'Pathway Gothic One' : this.fallbackFont;
    this.ctx.font = `${fontSize}px ${fontName}`;
    this.ctx.textAlign = 'left';
    this.ctx.fillStyle = '#ffe81f';
    this.ctx.textBaseline = 'top';
    
    let currentY = y;
    for (let line of lines) {
      this.ctx.fillText(line, x, currentY);
      currentY += lineHeight;
    }
    
    return currentY;
  }

  /**
   * Render complete crawl text
   */
  renderCrawl(title, subtitle, body, config) {
    const {
      titleSize,
      subSize,
      bodySize,
      columnWidth,
      useJustification,
      justificationQuality
    } = config;

    // Clear canvas
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Set solid color
    this.ctx.fillStyle = '#ffe81f';
    
    let y = 200;
    const startX = (this.canvasWidth - columnWidth) / 2;
    const lineHeight = bodySize * 1.4;

    // Render title
    if (title) {
      this.renderCenteredText(title, y, titleSize);
      y += titleSize * 2;
    }

    // Render subtitle
    if (subtitle) {
      this.renderCenteredText(subtitle, y, subSize);
      y += subSize * 2.5;
    }

    // Render body paragraphs
    const paragraphs = body.split('\n\n');
    
    for (let para of paragraphs) {
      const trimmedPara = para.trim();
      if (!trimmedPara) continue;

      if (useJustification) {
        // Use simple justification (more reliable)
        y = this.renderSimpleJustified(
          trimmedPara,
          startX,
          y,
          columnWidth,
          bodySize,
          lineHeight
        );
      } else {
        // Simple wrapping without justification
        y = this.renderSimpleWrapped(
          trimmedPara,
          startX,
          y,
          columnWidth,
          bodySize,
          lineHeight
        );
      }

      // Add paragraph spacing
      y += lineHeight * 0.5;
    }

    // Add significantly more bottom padding to avoid cutoff
    y += 1000;

    return y;
  }
}