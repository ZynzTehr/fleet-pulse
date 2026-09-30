import { describe, it, expect } from 'vitest';
import {
  GEAR_THEMES,
  SCROLL_SENSITIVITY,
  calculateGearAngles,
  renderGearsStageHTML,
} from '../src/js/components/gears.js';

describe('Background 3-Gear System', () => {
  describe('Kinematic Calculations & Meshing Physics', () => {
    it('supports the 4 required visual themes', () => {
      expect(GEAR_THEMES).toEqual(['blueprint', 'steel', 'amber', 'stealth']);
    });

    it('has a calibrated positive scroll sensitivity', () => {
      expect(SCROLL_SENSITIVITY).toBeGreaterThan(0);
      expect(SCROLL_SENSITIVITY).toBe(0.15);
    });

    it('calculates initial rest angles correctly at scrollY = 0', () => {
      const angles = calculateGearAngles(0);
      expect(angles.thetaCenter).toBe(0);
      expect(angles.thetaTopRight).toBe(65.0);
      expect(angles.thetaBottomLeft).toBe(175.0);
    });

    it('preserves exact transmission gear ratios during scroll', () => {
      // At 600px scroll, Master Gear 1 rotates exactly 90 degrees
      const angles = calculateGearAngles(600);
      expect(angles.thetaCenter).toBeCloseTo(90.0, 2);
      // Gear 2 has 18 teeth vs 36 teeth => 2.0x counter-clockwise ratio
      expect(angles.thetaTopRight).toBeCloseTo(-2.0 * 90.0 + 65.0, 2);
      expect(angles.thetaTopRight).toBeCloseTo(-115.0, 2);
      // Gear 3 has 24 teeth vs 36 teeth => 1.5x counter-clockwise ratio
      expect(angles.thetaBottomLeft).toBeCloseTo(-1.5 * 90.0 + 175.0, 2);
      expect(angles.thetaBottomLeft).toBeCloseTo(40.0, 2);
    });

    it('maintains perfect mathematical tooth-in-valley meshing at all scroll positions', () => {
      // Center Gear 1 (N1=36) and Top-Right Gear 2 (N2=18) mesh at angle phi1 = -35.0 deg
      // Center Gear 1 (N1=36) and Bottom-Left Gear 3 (N3=24) mesh at angle phi2 = +145.0 deg
      const phi1 = -35.0;
      const phi2 = 145.0;

      const p1 = 360.0 / 36; // 10 deg
      const p2 = 360.0 / 18; // 20 deg
      const p3 = 360.0 / 24; // 15 deg

      for (let scroll = 0; scroll <= 2000; scroll += 200) {
        const { thetaCenter, thetaTopRight, thetaBottomLeft } = calculateGearAngles(scroll);

        // Contact 1: Gear 1 and Gear 2
        const f1 = ((((phi1 - thetaCenter) % p1) + p1) % p1) / p1;
        const f2 = ((((phi1 + 180.0 - thetaTopRight) % p2) + p2) % p2) / p2;
        const sum1 = ((f1 + f2) % 1.0 + 1.0) % 1.0;
        expect(sum1).toBeCloseTo(0.5, 3); // exact anti-phase tooth-in-valley mesh

        // Contact 2: Gear 1 and Gear 3
        const f1_2 = ((((phi2 - thetaCenter) % p1) + p1) % p1) / p1;
        const f3 = ((((phi2 + 180.0 - thetaBottomLeft) % p3) + p3) % p3) / p3;
        const sum2 = ((f1_2 + f3) % 1.0 + 1.0) % 1.0;
        expect(sum2).toBeCloseTo(0.5, 3); // exact anti-phase tooth-in-valley mesh
      }
    });
  });

  describe('Clean Solid Geometry (No Dotted/Dashed Lines)', () => {
    const html = renderGearsStageHTML();

    it('renders all three gears in the SVG viewport', () => {
      expect(html).toContain('id="gear-center"');
      expect(html).toContain('id="gear-top-right"');
      expect(html).toContain('id="gear-bottom-left"');
    });

    it('does NOT contain dotted pitch lines on any gear', () => {
      expect(html).not.toContain('gear-pitch-line');
    });

    it('does NOT contain dashed meshing centerlines', () => {
      expect(html).not.toContain('mesh-centerline');
    });

    it('does NOT contain any stroke-dasharray attribute in the gear SVG', () => {
      expect(html).not.toContain('stroke-dasharray');
    });

    it('contains spokes, hubs, hex bolts, axle holes, and keyways for mechanical realism', () => {
      expect(html).toContain('class="gear-spoke"');
      expect(html).toContain('class="gear-bolt"');
      expect(html).toContain('class="gear-axle-hole"');
      expect(html).toContain('class="gear-keyway"');
    });
  });
});
