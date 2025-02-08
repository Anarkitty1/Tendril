import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Card } from '@/components/ui/card';

interface Point {
  x: number;
  y: number;
  vx: number;
  vy: number;
  baseX: number;
  baseY: number;
  distanceFromStart: number;
  phase: number;
  lastInfluence: number;
  influenceAmount: number;
  thickness: number;
  freedom: number;
}

type DrawPoint = Point | {
  x: number;
  y: number;
  thickness: number;
  influenceAmount?: number;
};

interface Line {
  startX: number;
  startY: number;
  length: number;
  controlPoints: Point[];
  frequency: number;
}

interface MousePosition {
  x: number;
  y: number;
  isDragging?: boolean;
}

const easeInOutSine = (x: number): number => {
  return -(Math.cos(Math.PI * x) - 1) / 2;
};

const EnhancedTendril = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const lineRef = useRef<Line | null>(null);
  const [dimensions, setDimensions] = useState({ width: window.innerWidth, height: window.innerHeight });
  const mouseRef = useRef<MousePosition>({ x: 0, y: 0 });
  const lastMouseRef = useRef<MousePosition>({ x: 0, y: 0 });
  const mouseVelocityRef = useRef<MousePosition>({ x: 0, y: 0 });
  const animationFrameRef = useRef<number>();
  const isAnimatingRef = useRef<boolean>(true);
  const timeRef = useRef<number>(Date.now());
  const touchRadiusRef = useRef(85);
  const lastTouchTimeRef = useRef(0);
  const lastInteractionRef = useRef(0);
  const isDraggingRef = useRef(false);

  useEffect(() => {
    const updateDimensions = () => {
      if (canvasRef.current) {
        const canvas = canvasRef.current;
        const width = window.innerWidth;
        const height = window.innerHeight;
        
        // Set both CSS and canvas dimensions
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
        canvas.width = width;
        canvas.height = height;
        
        setDimensions({ width, height });
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          console.error('Failed to get canvas context');
          return;
        }
        
        // Remove DPR scaling for now
        ctxRef.current = ctx;

        // Initialize line position for bottom-to-top orientation
        const startX = width * 0.5;  // Center horizontally
        const startY = height * 0.85; // Start near bottom
        const length = height * 0.65; // Keep same length

        const controlPoints: Point[] = Array(45).fill(null).map((_, index) => {
          const t = easeInOutSine(index / 44);
          const invertedT = 1 - t;
          
          // Adjust spacing to be wider at the bottom and tighter at top
          const positionT = Math.pow(t, 1.2); // This will space points more densely at bottom
          
          return {
            x: startX,
            y: startY - length * Math.pow(positionT, 0.95),
            vx: 0,
            vy: 0,
            baseX: startX,
            baseY: startY - length * positionT,
            distanceFromStart: length * positionT,
            phase: t * Math.PI * 2,
            lastInfluence: 0,
            influenceAmount: 0,
            thickness: Math.pow(t, 0.85) * 4.5,
            freedom: Math.pow(invertedT, 0.8) * 0.7 + 0.3
          };
        });

        lineRef.current = {
          startX,
          startY,
          length,
          controlPoints,
          frequency: 0.012
        };
      }
    };
    
    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => {
      window.removeEventListener('resize', updateDimensions);
      isAnimatingRef.current = false;
    };
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect || !lineRef.current) return;
    
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    // Check if click is within the top dot area
    const lastPoint = lineRef.current.controlPoints[lineRef.current.controlPoints.length - 1];
    const dx = mouseX - lastPoint.x;
    const dy = mouseY - lastPoint.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance < 20) { // Slightly larger than visual radius for better UX
      isDraggingRef.current = true;
      mouseRef.current = { x: mouseX, y: mouseY, isDragging: true };
    }
  }, []);

  const handleMouseUp = useCallback(() => {
    isDraggingRef.current = false;
    mouseRef.current.isDragging = false;
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const newX = e.clientX - rect.left;
    const newY = e.clientY - rect.top;
    
    if (Math.abs(newX - mouseRef.current.x) < 0.1 && Math.abs(newY - mouseRef.current.y) < 0.1) return;
    
    mouseVelocityRef.current = {
      x: (newX - lastMouseRef.current.x) * 0.00035,
      y: (newY - lastMouseRef.current.y) * 0.00035
    };
    
    lastMouseRef.current = { x: newX, y: newY };
    mouseRef.current = { x: newX, y: newY };
    lastTouchTimeRef.current = Date.now();
    lastInteractionRef.current = Date.now();

    // Update the tendril start position if dragging
    if (isDraggingRef.current && lineRef.current) {
      // Add gentler sway while dragging
      const swayX = Math.sin(Date.now() * 0.0008) * 1.2;
      const swayY = Math.cos(Date.now() * 0.0012) * 1.0;
      
      // Update the end point (top) with smoother interpolation
      const lastPoint = lineRef.current.controlPoints[lineRef.current.controlPoints.length - 1];
      const targetX = newX + swayX;
      const targetY = newY + swayY;
      
      // Much softer interpolation for dragging
      const dragEase = 0.045;
      lastPoint.vx += (targetX - lastPoint.x) * dragEase;
      lastPoint.vy += (targetY - lastPoint.y) * dragEase;
      
      const damping = 0.92;
      lastPoint.vx *= damping;
      lastPoint.vy *= damping;
      
      lastPoint.x += lastPoint.vx;
      lastPoint.y += lastPoint.vy;
      
      // Add very subtle natural sway to the top point
      lastPoint.x += Math.sin(Date.now() * 0.001) * 0.4;
      lastPoint.y += Math.cos(Date.now() * 0.0015) * 0.3;
      
      // Update control points with a more organic movement
      lineRef.current.controlPoints.forEach((point, index) => {
        const t = index / (lineRef.current!.controlPoints.length - 1);
        
        if (index === 0) {
          // Bottom point sways around its base position
          point.x = point.baseX + Math.sin(Date.now() * 0.001) * 3;
          point.y = point.baseY + Math.cos(Date.now() * 0.0015) * 2;
        } else {
          // Calculate influence based on distance from top
          const influence = Math.pow(t, 2.2); // Stronger influence near top
          const dragForce = {
            x: (lastPoint.x - point.x) * influence * 0.015,
            y: (lastPoint.y - point.y) * influence * 0.015
          };

          // Apply drag force to velocity
          point.vx += dragForce.x;
          point.vy += dragForce.y;

          // Add natural sway
          const swayAmount = (1 - influence) * 2;
          point.vx += Math.sin(Date.now() * 0.001 + t * Math.PI) * 0.02 * swayAmount;
          point.vy += Math.cos(Date.now() * 0.0015 + t * Math.PI) * 0.02 * swayAmount;

          // Apply damping
          const pointDamping = 0.95 + (influence * 0.03);
          point.vx *= pointDamping;
          point.vy *= pointDamping;

          // Update position
          point.x += point.vx;
          point.y += point.vy;

          // Add spring force towards base position
          const springForce = 0.01 * (1 - influence);
          point.vx += (point.baseX - point.x) * springForce;
          point.vy += (point.baseY - point.y) * springForce;
        }
      });
    }
  }, []);

  useEffect(() => {
    if (!lineRef.current || !canvasRef.current || !ctxRef.current) {
      console.log('Missing refs:', {
        line: !!lineRef.current,
        canvas: !!canvasRef.current,
        ctx: !!ctxRef.current
      });
      return;
    }

    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    
    const smoothstep = (min: number, max: number, value: number): number => {
      const x = Math.max(0, Math.min(1, (value - min) / (max - min)));
      return x * x * (3 - 2 * x);
    };

    const smoothWave = (t: number, phase: number, frequency: number): number => {
      const raw = Math.sin(phase * frequency);
      const envelope = smoothstep(0, 0.2, t) * smoothstep(1, 0.8, t);
      
      const microVariation = 
        Math.sin(phase * 3.7) * 0.12 * Math.sin(phase * 0.3) +
        Math.sin(phase * 2.4) * 0.08 * Math.sin(phase * 0.5) +
        Math.sin(phase * 5.2) * 0.05 * Math.sin(phase * 0.7);
      
      return (raw + microVariation * envelope) * envelope;
    };
    
    const animate = () => {
      const ctx = ctxRef.current;
      const canvas = canvasRef.current;
      
      if (!ctx || !canvas) return;
      
      // Clear canvas with semi-transparent black for trail effect
      ctx.fillStyle = 'rgba(0, 0, 0, 0.95)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      timeRef.current = (Date.now() * 0.0006) % (Math.PI * 2);
      
      const prevLine = lineRef.current;
      if (!prevLine) return;

      const basePoints = prevLine.controlPoints.map((point, index) => {
        const t = index / (prevLine.controlPoints.length - 1);
        const basePhase = (timeRef.current * 0.5) + (point.phase * 0.6);
        
        const topFade = Math.pow(smoothstep(0, 0.45, t), 1.3);
        
        const waveOffset = (1 - t) * 2.2;
        const adjustedPhase = basePhase + waveOffset;
        
        // Adjust wave calculations for horizontal motion
        const primaryAmplitude = 45 * Math.pow(1 - t, 0.2) * smoothstep(0, 0.3, t);
        const primaryWave = smoothWave(t, adjustedPhase, 0.07) * primaryAmplitude * topFade;
        
        const secondaryAmplitude = 20 * Math.pow(1 - t, 0.3) * smoothstep(0, 0.32, t);
        const secondaryWave = smoothWave(t, adjustedPhase + Math.PI * 0.5, 0.025) * secondaryAmplitude * topFade;
        
        const detailAmplitude = 2.5 * Math.pow(1 - t, 0.4) * smoothstep(0, 0.35, t);
        const detailWave = (
          smoothWave(t, adjustedPhase - Math.PI * 0.3, 0.006) * detailAmplitude +
          smoothWave(t, adjustedPhase + Math.PI * 0.7, 0.004) * detailAmplitude * 0.3
        ) * topFade;
        
        const bottomFade = smoothstep(1, 0.9, t);
        
        return {
          natural: (primaryWave + secondaryWave + detailWave) * bottomFade,
          amplitudeFactor: Math.pow(1 - t, 0.3) * smoothstep(0, 0.15, t) * bottomFade
        };
      });

      const newControlPoints = prevLine.controlPoints.map((point, index) => {
        const t = index / (prevLine.controlPoints.length - 1);
        const baseMotion = basePoints[index];
        
        // Adjust horizontal response for side-to-side movement
        const horizontalResponse = 0.00025 * (1 + point.freedom * 1.3);
        const idealX = prevLine.startX + baseMotion.natural;
        const dx = idealX - point.x;
        point.vx += dx * horizontalResponse;

        const dy = point.y - mouseRef.current.y;
        const distanceToMouse = Math.sqrt(dx * dx + dy * dy);
        
        const timeSinceInteraction = Date.now() - lastInteractionRef.current;
        const returnForce = Math.min(timeSinceInteraction / 12000, 0.7);
        
        const influenceRadius = touchRadiusRef.current * (3.2 + point.freedom * 0.5);
        if (distanceToMouse < influenceRadius) {
          const distFactor = distanceToMouse / influenceRadius;
          const smoothInfluence = (1 - Math.pow(distFactor, 2.8)) * 
                                point.freedom * 0.18;
          
          const influence = Math.max(0, smoothInfluence);
          
          point.lastInfluence = Date.now();
          point.influenceAmount = influence;

          const pushStrength = 0.00012 * influence;
          const distanceScale = Math.pow(1 - distFactor, 1.6);
          point.vx += (dx / distanceToMouse) * -pushStrength * distanceScale;
          point.vy += (dy / distanceToMouse) * -pushStrength * distanceScale;
          
          point.vx += mouseVelocityRef.current.x * influence * (0.18 + point.freedom * 0.2);
          point.vy += mouseVelocityRef.current.y * influence * (0.18 + point.freedom * 0.2);
        } else {
          const timeSinceInfluence = Date.now() - point.lastInfluence;
          if (timeSinceInfluence < 6000) {
            point.influenceAmount *= Math.pow(0.9994, timeSinceInfluence / 20);
          } else {
            point.influenceAmount = 0;
          }
        }
        
        const homeX = prevLine.startX + baseMotion.natural;
        const homeY = point.baseY;
        const dxHome = homeX - point.x;
        const dyHome = homeY - point.y;
        
        // Adjust return force for vertical orientation
        const returnStrength = 0.00004 * returnForce * (1 - Math.pow(1 - t, 2.0));
        point.vx += dxHome * returnStrength;
        point.vy += dyHome * returnStrength * 1.2; // Slightly stronger vertical return
        
        const damping = 0.972 - (point.freedom * 0.0006);
        const velocityDamping = Math.max(damping, 0 - Math.sqrt(point.vx * point.vx + point.vy * point.vy) * 0.008);
        point.vx *= velocityDamping;
        point.vy *= velocityDamping;
        
        point.x += point.vx * (1 + point.freedom * 0.5);
        point.y += point.vy * (1 + point.freedom * 0.5);
        
        const xConstraint = 0.0003 * (1 - point.freedom * 0.92) * (1 - returnForce * 0.7);
        const xForce = (point.baseX - point.x) * xConstraint * (1 + Math.sin(timeRef.current * 0.6) * 0.08);
        point.x += xForce;
        
        // Add slight downward drift to enhance vertical movement
        point.vy += 0.00001 * point.freedom;
        
        return point;
      });

      for (let i = 0; i < newControlPoints.length - 1; i++) {
        const t = i / newControlPoints.length;
        const p1 = newControlPoints[i];
        const p2 = newControlPoints[i + 1];
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        
        // Special handling for the top section
        const isTopSection = i >= newControlPoints.length - 3;
        const topT = isTopSection ? (i - (newControlPoints.length - 3)) / 2 : 0;
        const smoothTopT = isTopSection ? Math.pow(topT, 2.2) : 0;
        
        const currentSpacing = Math.sqrt(dx * dx + dy * dy);
        const desiredSpacing = p2.baseX - p1.baseX;
        
        // Significantly reduce forces near the top
        const springForce = (currentSpacing - desiredSpacing) * 
          (0.00008 * (1 - Math.pow(t, 1.4))) * 
          (isTopSection ? (1 - smoothTopT) * 0.3 : 1); // Greatly reduce force at top
        
        const angle = Math.atan2(dy, dx);
        
        // Almost eliminate tension variation at the top
        const tensionVariation = Math.abs(currentSpacing - desiredSpacing) * 
          0.002 * (isTopSection ? (1 - smoothTopT) * 0.2 : 1);
        
        const springForceWithTension = springForce * tensionVariation;
        
        // Minimal rotation at top
        const rotationAngle = Math.sin(timeRef.current * 0.3 + t * Math.PI) * 
          0.001 * (isTopSection ? (1 - smoothTopT) : 1);
        
        const forceAngle = angle + rotationAngle;
        
        // Apply forces with smooth falloff at top
        const forceMultiplier = isTopSection ? (1 - smoothTopT) * 0.3 : 1;
        p1.vx += Math.cos(forceAngle) * springForceWithTension * forceMultiplier;
        p1.vy += Math.sin(forceAngle) * springForceWithTension * forceMultiplier;
        p2.vx -= Math.cos(forceAngle) * springForceWithTension * forceMultiplier;
        p2.vy -= Math.sin(forceAngle) * springForceWithTension * forceMultiplier;
      }

      const points: DrawPoint[] = [
        { x: prevLine.startX, y: prevLine.startY, thickness: 1.5 },
        ...newControlPoints
      ];
      
      // Set line width before beginning the path
      ctx.lineWidth = 1.5;
      
      // Single pass drawing with gradient
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      
      for (let i = 0; i < points.length - 1; i++) {
        const tension = 8.0 + (i / points.length) * 4.0; // Gradually increase tension towards the top
        
        const p0 = points[Math.max(0, i - 1)];
        const p1 = points[i];
        const p2 = points[i + 1];
        const p3 = points[Math.min(points.length - 1, i + 2)];
        
        // Adjust control points more smoothly near the top
        const topFactor = Math.pow(1 - i / (points.length - 1), 2);
        const cp1x = p1.x + (p2.x - p0.x) / (tension + topFactor * 4);
        const cp1y = p1.y + (p2.y - p0.y) / (tension + topFactor * 4);
        const cp2x = p2.x - (p3.x - p1.x) / (tension + topFactor * 4);
        const cp2y = p2.y - (p3.y - p1.y) / (tension + topFactor * 4);
        
        ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
      }

      const lineGradient = ctx.createLinearGradient(
        prevLine.startX, prevLine.startY,
        points[points.length - 1].x, points[points.length - 1].y
      );
      
      // Update the gradient stops to be more opaque at the top
      lineGradient.addColorStop(1, 'rgba(255, 255, 255, 0.25)');
      lineGradient.addColorStop(0.8, 'rgba(255, 255, 255, 0.45)');
      lineGradient.addColorStop(0.6, 'rgba(255, 255, 255, 0.65)');
      lineGradient.addColorStop(0.3, 'rgba(255, 255, 255, 0.85)');
      lineGradient.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
      
      ctx.strokeStyle = lineGradient;
      
      // Update the thickness calculation to start even thinner
      const t = timeRef.current;
      points.forEach((point, i) => {
        if (i > 0) {
          const progress = i / points.length;
          const thickness = progress < 0.3 
            ? 0.8 + (progress * 14) // Start thinner (0.8 instead of 1.5) and ramp up slightly faster
            : 5.5 * (1 - progress * 0.65);
          const variation = 1 + Math.sin(t * 2 + i * 0.2) * 0.03;
          ctx.lineWidth = thickness * variation;
        }
      });
      
      ctx.stroke();

      // Add a dot at the top of the tendril with radial gradient
      const dotRadius = 6;
      const lastPoint = newControlPoints[newControlPoints.length - 1];
      const dotX = lastPoint.x;
      const dotY = lastPoint.y;
      
      // Add a larger, softer glow behind the dot
      const outerGlow = ctx.createRadialGradient(
        dotX, dotY, 0,
        dotX, dotY, dotRadius * 2
      );
      outerGlow.addColorStop(0, 'rgba(255, 255, 255, 0.2)');
      outerGlow.addColorStop(0.5, 'rgba(255, 255, 255, 0.1)');
      outerGlow.addColorStop(1, 'rgba(255, 255, 255, 0)');
      
      ctx.beginPath();
      ctx.arc(dotX, dotY, dotRadius * 2, 0, Math.PI * 2);
      ctx.fillStyle = outerGlow;
      ctx.fill();

      // Draw the main dot with a softer gradient
      const radialGradient = ctx.createRadialGradient(
        dotX, dotY, 0,
        dotX, dotY, dotRadius
      );
      radialGradient.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
      radialGradient.addColorStop(0.7, 'rgba(255, 255, 255, 0.3)');
      radialGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
      
      ctx.beginPath();
      ctx.arc(dotX, dotY, dotRadius, 0, Math.PI * 2);
      ctx.fillStyle = radialGradient;
      ctx.fill();

      lineRef.current = { ...prevLine, controlPoints: newControlPoints };

      // Request next frame
      if (isAnimatingRef.current) {
        animationFrameRef.current = requestAnimationFrame(animate);
      }
    };

    // Make sure animation starts
    console.log('Starting animation');
    isAnimatingRef.current = true;
    requestAnimationFrame(animate);

    return () => {
      console.log('Cleaning up animation');
      isAnimatingRef.current = false;
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  return (
    <div className="fixed inset-0 bg-black">
      <canvas
        ref={canvasRef}
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          cursor: isDraggingRef.current ? 'grabbing' : 'default'
        }}
      />
    </div>
  );
};

export default EnhancedTendril;
