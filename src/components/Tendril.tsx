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

  useEffect(() => {
    const updateDimensions = () => {
      if (canvasRef.current) {
        const canvas = canvasRef.current;
        
        const width = window.innerWidth;
        const height = window.innerHeight;
        
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
        
        const dpr = window.devicePixelRatio || 1;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        
        setDimensions({ width, height });
        
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        ctx.scale(dpr, dpr);
        ctxRef.current = ctx;
        
        // Add this test drawing
        ctx.fillStyle = 'white';
        ctx.fillRect(100, 100, 100, 100);

        const startX = width * 0.25;
        const startY = height * 0.4;
        const length = width * 0.5;

        const controlPoints: Point[] = Array(65).fill(null).map((_, index) => {
          const t = easeInOutSine(index / 64);
          return {
            x: startX + length * Math.pow(t, 0.95),
            y: startY,
            vx: 0,
            vy: 0,
            baseX: startX + length * t,
            baseY: startY,
            distanceFromStart: length * t,
            phase: t * Math.PI * 2,
            lastInfluence: 0,
            influenceAmount: 0,
            thickness: Math.pow(1 - t, 0.85) * 2.5,
            freedom: Math.pow(t, 1.3) * 0.82 + 0.18
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
  }, []);

  useEffect(() => {
    if (!lineRef.current || !canvasRef.current || !ctxRef.current) return;

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
      console.log('Animation frame running');
      timeRef.current += 0.00006 * (1 + Math.sin(timeRef.current * 0.4) * 0.15);
      
      ctx.fillStyle = 'rgba(0, 0, 0, 0.965)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      const prevLine = lineRef.current;
      if (!prevLine) return;

      const basePoints = prevLine.controlPoints.map((point, index) => {
        const t = index / (prevLine.controlPoints.length - 1);
        const basePhase = timeRef.current + point.phase;
        
        const primaryAmplitude = 38 * Math.pow(1 - t, 0.35) * smoothstep(0, 0.22, t);
        const primaryWave = smoothWave(t, basePhase, 0.32) * primaryAmplitude;
        
        const secondaryAmplitude = 16 * Math.pow(1 - t, 0.45) * smoothstep(0, 0.25, t);
        const secondaryWave = smoothWave(t, basePhase + point.phase, 0.05) * secondaryAmplitude;
        
        const detailAmplitude = 8 * Math.pow(1 - t, 0.5) * smoothstep(0, 0.28, t);
        const detailWave = smoothWave(t, basePhase - point.phase * 1.3, 0.018) * detailAmplitude +
                          smoothWave(t, basePhase * 1.5, 0.015) * detailAmplitude * 0.5;
        
        const endFade = smoothstep(1, 0.9, t);
        
        return {
          natural: (primaryWave + secondaryWave + detailWave) * endFade,
          amplitudeFactor: Math.pow(1 - t, 0.3) * smoothstep(0, 0.15, t) * endFade
        };
      });

      const newControlPoints = prevLine.controlPoints.map((point, index) => {
        const t = index / (prevLine.controlPoints.length - 1);
        const baseMotion = basePoints[index];
        
        const verticalResponse = 0.00025 * (1 + point.freedom * 1.3);
        const idealY = prevLine.startY + baseMotion.natural;
        const dy = idealY - point.y;
        point.vy += dy * verticalResponse;

        const dx = point.x - mouseRef.current.x;
        const dy2 = point.y - mouseRef.current.y;
        const distanceToMouse = Math.sqrt(dx * dx + dy2 * dy2);
        
        const timeSinceInteraction = Date.now() - lastInteractionRef.current;
        const returnForce = Math.min(timeSinceInteraction / 7500, 1);
        
        const influenceRadius = touchRadiusRef.current * (3.2 + point.freedom * 0.5);
        if (distanceToMouse < influenceRadius) {
          const distFactor = distanceToMouse / influenceRadius;
          const smoothInfluence = (1 - Math.pow(distFactor, 2.8)) * 
                                point.freedom * 0.18;
          
          const influence = Math.max(0, smoothInfluence);
          
          point.lastInfluence = Date.now();
          point.influenceAmount = influence;

          const pushStrength = 0.00015 * influence;
          const distanceScale = Math.pow(1 - distFactor, 1.6);
          point.vx += (dx / distanceToMouse) * -pushStrength * distanceScale;
          point.vy += (dy2 / distanceToMouse) * -pushStrength * distanceScale;
          
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
        
        const homeX = point.baseX;
        const homeY = prevLine.startY + baseMotion.natural;
        const dxHome = homeX - point.x;
        const dyHome = homeY - point.y;
        
        const returnStrength = 0.00007 * returnForce * (1 - Math.pow(1 - t, 2.0));
        point.vx += dxHome * returnStrength;
        point.vy += dyHome * returnStrength;
        
        const damping = 0.9995 - (point.freedom * 0.0008);
        const velocityDamping = Math.max(damping, 1 - Math.sqrt(point.vx * point.vx + point.vy * point.vy) * 0.06);
        point.vx *= velocityDamping;
        point.vy *= velocityDamping;
        
        point.x += point.vx * (1 + point.freedom * 0.9);
        point.y += point.vy * (1 + point.freedom * 0.9);
        
        const xConstraint = 0.0005 * (1 - point.freedom * 0.92) * (1 - returnForce * 0.7);
        const xForce = (point.baseX - point.x) * xConstraint * (1 + Math.sin(timeRef.current * 0.6) * 0.08);
        point.x += xForce;
        
        return point;
      });

      for (let i = 1; i < newControlPoints.length; i++) {
        const t = i / newControlPoints.length;
        const p1 = newControlPoints[i - 1];
        const p2 = newControlPoints[i];
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        
        const rotationAngle = Math.sin(timeRef.current * 0.5 + t * Math.PI * 1.3) * 0.0012;
        const rotatedDx = dx * Math.cos(rotationAngle) - dy * Math.sin(rotationAngle);
        const rotatedDy = dx * Math.sin(rotationAngle) + dy * Math.cos(rotationAngle);
        
        const currentSpacing = Math.sqrt(dx * dx + dy * dy);
        const desiredSpacing = p2.baseX - p1.baseX;
        
        const springForce = (currentSpacing - desiredSpacing) * 
          (0.0001 * (1 - Math.pow(t, 1.4)));
        const angle = Math.atan2(dy, dx);
        
        const tensionVariation = 1 + Math.abs(currentSpacing - desiredSpacing) * 0.006;
        const springForceWithTension = springForce * tensionVariation;
        
        const forceAngle = angle + rotationAngle;
        p1.vx += Math.cos(forceAngle) * springForceWithTension;
        p1.vy += Math.sin(forceAngle) * springForceWithTension;
        p2.vx -= Math.cos(forceAngle) * springForceWithTension;
        p2.vy -= Math.sin(forceAngle) * springForceWithTension;
      }

      const points: DrawPoint[] = [
        { x: prevLine.startX, y: prevLine.startY, thickness: 2.5 },
        ...newControlPoints
      ];
      
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      
      for (let i = 0; i < points.length - 1; i++) {
        const tension = 8.0;
        
        const p0 = points[Math.max(0, i - 1)];
        const p1 = points[i];
        const p2 = points[i + 1];
        const p3 = points[Math.min(points.length - 1, i + 2)];
        
        const cp1x = p1.x + (p2.x - p0.x) / tension;
        const cp1y = p1.y + (p2.y - p0.y) / tension;
        const cp2x = p2.x - (p3.x - p1.x) / tension;
        const cp2y = p2.y - (p3.y - p1.y) / tension;
        
        ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
      }

      const lineGradient = ctx.createLinearGradient(
        prevLine.startX, prevLine.startY,
        points[points.length - 1].x, points[points.length - 1].y
      );
      lineGradient.addColorStop(0, 'rgba(255, 255, 255, 0.85)');
      lineGradient.addColorStop(0.4, 'rgba(255, 255, 255, 0.52)');
      lineGradient.addColorStop(0.7, 'rgba(255, 255, 255, 0.32)');
      lineGradient.addColorStop(1, 'rgba(255, 255, 255, 0.15)');
      
      ctx.strokeStyle = lineGradient;
      
      points.forEach((point, i) => {
        if (i > 0) {
          const thicknessVariation = 1 + Math.sin(timeRef.current * 2 + i * 0.2) * 0.05;
          ctx.lineWidth = point.thickness * 
            (1 + (point.influenceAmount || 0) * 0.3) * thicknessVariation;
        }
      });
      
      ctx.stroke();
      
      lineRef.current = { ...prevLine, controlPoints: newControlPoints };

      if (isAnimatingRef.current) {
        animationFrameRef.current = requestAnimationFrame(animate);
      }
    };
    
    animate();
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  return (
    <Card className="fixed inset-0 w-full h-full bg-black">
      <canvas
        ref={canvasRef}
        width={dimensions.width}
        height={dimensions.height}
        onMouseMove={handleMouseMove}
        className="w-full h-full cursor-default"
      />
    </Card>
  );
};

export default EnhancedTendril;
