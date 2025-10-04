# Waterfield Tech - Branding Guide for Electron App

## Brand Overview
Waterfield Tech is a global customer experience technology and services provider specializing in Contact Center as a Service (CCaaS), conversational AI, and workforce engagement management platforms. They position themselves as trusted enterprise partners serving Fortune 500 companies worldwide.

## Color Palette

### Primary Colors
- **Primary Blue**: `#1B4B8C` (Deep corporate blue - trust, reliability, technology)
- **Accent Blue**: `#2E7CE4` (Brighter blue for interactive elements, CTAs)
- **White**: `#FFFFFF` (Clean, professional background)
- **Dark Gray**: `#2C3E50` (Text, headers, professional contrast)

### Secondary Colors
- **Light Gray**: `#F8F9FA` (Background sections, cards)
- **Medium Gray**: `#6C757D` (Subtle text, borders)
- **Success Green**: `#28A745` (Positive states, success messages)
- **Warning Orange**: `#FD7E14` (Attention, warnings)
- **Tech Gradient**: Linear gradient from `#1B4B8C` to `#2E7CE4`

## Typography
### Primary Font Stack
```css
font-family: 'Inter', 'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif;
```

### Font Weights & Sizes
- **Headings**: 600-700 weight, sizes 24px-48px
- **Body Text**: 400 weight, 16px base size
- **Small Text**: 400 weight, 14px
- **Labels**: 500 weight, 14px

## Glassmorphism Design System

### Glass Components
```css
/* Primary Glass Card */
background: rgba(255, 255, 255, 0.1);
backdrop-filter: blur(20px);
border: 1px solid rgba(255, 255, 255, 0.2);
border-radius: 16px;
box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);

/* Secondary Glass Card (darker) */
background: rgba(27, 75, 140, 0.1);
backdrop-filter: blur(20px);
border: 1px solid rgba(27, 75, 140, 0.2);
border-radius: 12px;
```

### Button Styles
```css
/* Primary Button */
background: linear-gradient(135deg, #1B4B8C, #2E7CE4);
backdrop-filter: blur(10px);
border: none;
border-radius: 8px;
color: white;
padding: 12px 24px;
transition: all 0.3s ease;

/* Glass Button */
background: rgba(255, 255, 255, 0.15);
backdrop-filter: blur(15px);
border: 1px solid rgba(255, 255, 255, 0.3);
border-radius: 8px;
color: #1B4B8C;
```

## Brand Personality & Tone
- **Professional**: Enterprise-grade, reliable, trustworthy
- **Innovative**: AI-forward, cutting-edge technology
- **Client-Centric**: Focused on customer success and satisfaction
- **Global**: Scalable, worldwide reach
- **Expert**: Deep industry knowledge, consultative approach

## UI/UX Guidelines

### Layout Principles
- Clean, spacious layouts with plenty of whitespace
- Card-based information architecture
- Consistent 16px base spacing grid
- Responsive design with mobile-first approach

### Navigation
- Top navigation bar with glassmorphism effect
- Sidebar navigation for complex applications
- Breadcrumb navigation for deep hierarchies
- Consistent iconography (Lucide React icons recommended)

### Content Hierarchy
1. **Hero Sections**: Large headings, gradient backgrounds
2. **Feature Cards**: Glass cards with icons and descriptions
3. **Data Visualization**: Clean charts with brand colors
4. **Forms**: Glass input fields with subtle borders

## Component Specifications

### Header/Navigation
```css
background: rgba(255, 255, 255, 0.95);
backdrop-filter: blur(20px);
border-bottom: 1px solid rgba(27, 75, 140, 0.1);
```

### Cards
```css
background: rgba(255, 255, 255, 0.1);
backdrop-filter: blur(20px);
border: 1px solid rgba(255, 255, 255, 0.2);
border-radius: 16px;
padding: 24px;
```

### Inputs
```css
background: rgba(255, 255, 255, 0.8);
backdrop-filter: blur(10px);
border: 1px solid rgba(27, 75, 140, 0.2);
border-radius: 8px;
padding: 12px 16px;
```

## Background Patterns
- Subtle gradient overlays
- Geometric patterns in low opacity
- Soft mesh gradients using brand colors
- Clean, minimal textures

## Iconography
- Use Lucide React icons for consistency
- 24px standard size for most UI elements
- 16px for small/inline icons
- 32px+ for feature highlights
- Consistent stroke width (1.5-2px)

## Animation Guidelines
- Smooth transitions (300ms ease)
- Subtle hover effects on interactive elements
- Glass morphing effects on state changes
- Minimal loading animations
- Respect user preferences for reduced motion

## Accessibility
- Maintain WCAG 2.1 AA contrast ratios
- Use semantic HTML structure
- Provide keyboard navigation
- Include ARIA labels for screen readers
- Ensure glass effects don't compromise readability

## Implementation Notes for Claude Code
1. Use Tailwind CSS v3 for rapid prototyping
2. Create custom CSS classes for glassmorphism effects
3. Implement proper backdrop-filter browser support
4. Consider performance impact of blur effects
5. Test glass effects across different backgrounds
6. Ensure responsiveness across all device sizes

## Brand Applications
- Professional, enterprise-focused design
- Clean, modern aesthetic with subtle sophistication
- Trust-building through consistent brand application
- Technology-forward visual language
- Global scalability in design choices