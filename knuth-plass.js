/**
 * Knuth-Plass Line Breaking Algorithm
 * Professional paragraph justification with optimal spacing
 */

export class KnuthPlassJustifier {
  constructor(options = {}) {
    this.tolerance = options.tolerance || 2;
    this.hyphenPenalty = options.hyphenPenalty || 50;
    this.linePenalty = options.linePenalty || 10;
    this.fitnessClasses = 4;
    this.infinity = 10000;
  }

  /**
   * Break a paragraph into justified lines using Knuth-Plass algorithm
   */
  breakLines(items, lineWidths) {
    // Start with initial active node
    const activeNodes = [this.createNode(0, 0, 1, 0, 0, 0, [])];
    const sumWidth = this.computeSums(items);
    
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      
      // Only consider breaks at glue or penalty items
      if (item.type === 'box') {
        continue;
      }
      
      if (item.type === 'glue' || (item.type === 'penalty' && item.penalty < this.infinity)) {
        const newActiveNodes = [];
        
        for (let node of activeNodes) {
          const lineIdx = node.line;
          const targetWidth = lineWidths[Math.min(lineIdx, lineWidths.length - 1)];
          
          const ratio = this.computeAdjustmentRatio(i, node.position, items, sumWidth, targetWidth);
          
          // Skip if line is too tight
          if (ratio < -1) {
            continue;
          }
          
          // Check if this is a feasible breakpoint
          if (ratio >= -1 && ratio <= this.tolerance) {
            const demerits = this.computeDemerits(ratio, item, node);
            const fitness = this.computeFitness(ratio);
            
            const newNode = this.createNode(
              i + 1,  // Position after this break
              lineIdx + 1,
              fitness,
              node.totalDemerits + demerits,
              ratio,
              node.totalWidth + sumWidth[i].width,
              [...node.path, i]
            );
            
            newActiveNodes.push(newNode);
          }
          
          // Keep the node active for future breaks
          newActiveNodes.push(node);
        }
        
        // Remove duplicates and keep best nodes
        activeNodes.length = 0;
        const bestByPosition = new Map();
        
        for (let node of newActiveNodes) {
          const key = `${node.position}-${node.line}`;
          if (!bestByPosition.has(key) || node.totalDemerits < bestByPosition.get(key).totalDemerits) {
            bestByPosition.set(key, node);
          }
        }
        
        activeNodes.push(...bestByPosition.values());
        
        // Limit number of active nodes to prevent explosion
        activeNodes.sort((a, b) => a.totalDemerits - b.totalDemerits);
        if (activeNodes.length > 30) {
          activeNodes.length = 30;
        }
      }
    }
    
    // Find best final node
    if (activeNodes.length === 0) {
      console.warn('No valid breakpoints found, using fallback');
      return [];
    }
    
    activeNodes.sort((a, b) => a.totalDemerits - b.totalDemerits);
    return activeNodes[0].path;
  }

  createNode(position, line, fitness, totalDemerits, ratio, totalWidth, path) {
    return { position, line, fitness, totalDemerits, ratio, totalWidth, path };
  }

  computeSums(items) {
    const sums = [];
    let width = 0, stretch = 0, shrink = 0;
    
    for (let item of items) {
      if (item.type === 'box') {
        width += item.width || 0;
      } else if (item.type === 'glue') {
        width += item.width || 0;
        stretch += item.stretch || 0;
        shrink += item.shrink || 0;
      }
      sums.push({ width, stretch, shrink });
    }
    
    return sums;
  }

  computeAdjustmentRatio(breakIdx, startIdx, items, sumWidth, targetWidth) {
    // Calculate actual width of content
    let actualWidth = sumWidth[breakIdx].width;
    if (startIdx > 0) {
      actualWidth -= sumWidth[startIdx - 1].width;
    }
    
    // Subtract trailing glue at end of line
    if (breakIdx < items.length && items[breakIdx].type === 'glue') {
      actualWidth -= items[breakIdx].width || 0;
    }
    
    if (Math.abs(actualWidth - targetWidth) < 0.001) {
      return 0;
    }
    
    if (actualWidth < targetWidth) {
      // Need to stretch
      let stretch = sumWidth[breakIdx].stretch;
      if (startIdx > 0) {
        stretch -= sumWidth[startIdx - 1].stretch;
      }
      
      if (stretch > 0) {
        return (targetWidth - actualWidth) / stretch;
      }
      return this.infinity;
    } else {
      // Need to shrink
      let shrink = sumWidth[breakIdx].shrink;
      if (startIdx > 0) {
        shrink -= sumWidth[startIdx - 1].shrink;
      }
      
      if (shrink > 0) {
        return (targetWidth - actualWidth) / shrink;
      }
      return -this.infinity;
    }
  }

  computeDemerits(ratio, item, previousNode) {
    let demerits = 0;
    
    // Base badness calculation
    const badness = 100 * Math.pow(Math.abs(ratio), 3);
    
    // Line penalty
    demerits = Math.pow(this.linePenalty + badness, 2);
    
    // Add penalty from item
    if (item.type === 'penalty' && item.penalty >= 0) {
      demerits += Math.pow(item.penalty, 2);
    }
    
    // Fitness class difference penalty
    const fitness = this.computeFitness(ratio);
    if (Math.abs(fitness - previousNode.fitness) > 1) {
      demerits += 100;
    }
    
    return demerits;
  }

  computeFitness(ratio) {
    if (ratio < -0.5) return 0;
    if (ratio <= 0.5) return 1;
    if (ratio <= 1) return 2;
    return 3;
  }

  /**
   * Convert text with font metrics into items for line breaking
   */
  createItemsFromText(words, fontSize, opentypeFont, spaceWidth) {
    const items = [];
    
    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      const width = this.measureWordWidth(word, fontSize, opentypeFont);
      
      // Add word as box
      items.push({
        type: 'box',
        width: width,
        value: word
      });
      
      // Add space as glue (except after last word)
      if (i < words.length - 1) {
        items.push({
          type: 'glue',
          width: spaceWidth,
          stretch: spaceWidth * 0.5,
          shrink: spaceWidth * 0.33
        });
      }
    }
    
    // Force break at end
    items.push({
      type: 'penalty',
      width: 0,
      penalty: -this.infinity,
      flagged: false
    });
    
    return items;
  }

  measureWordWidth(word, fontSize, opentypeFont) {
    if (!opentypeFont) {
      return word.length * fontSize * 0.6;
    }
    
    const scale = fontSize / opentypeFont.unitsPerEm;
    let width = 0;
    
    for (let char of word) {
      const glyph = opentypeFont.charToGlyph(char);
      if (glyph && glyph.advanceWidth) {
        width += glyph.advanceWidth * scale;
      }
    }
    
    return width;
  }

  /**
   * Format justified lines with exact spacing
   */
  formatJustifiedLines(items, breakpoints, lineWidths, sumWidth) {
    const lines = [];
    let start = 0;
    
    for (let i = 0; i < breakpoints.length; i++) {
      const end = breakpoints[i];
      const targetWidth = lineWidths[Math.min(i, lineWidths.length - 1)];
      
      const line = this.formatLine(items, start, end, targetWidth, sumWidth);
      lines.push(line);
      
      start = end + 1;
    }
    
    return lines;
  }

  formatLine(items, start, end, targetWidth, sumWidth) {
    const lineItems = [];
    
    for (let i = start; i <= end; i++) {
      const item = items[i];
      if (item.type === 'box' || item.type === 'glue') {
        lineItems.push(item);
      }
    }
    
    const ratio = this.computeAdjustmentRatio(end, start, items, sumWidth, targetWidth);
    
    return {
      items: lineItems,
      ratio: ratio,
      targetWidth: targetWidth
    };
  }
}