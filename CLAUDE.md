# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Next.js 15 application called "JobTracker" - a job application management system with Google Sheets integration. The app allows users to view, filter, and track job applications from Google Sheets data in a card-based UI format.

## Development Commands

- `npm run dev --turbopack` - Start development server with Turbo bundling
- `npm run build` - Build production application  
- `npm run start` - Start production server
- `npm run lint` - Run ESLint (note: configured to ignore build errors)

## Architecture Overview

### Tech Stack
- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript with strict mode
- **Styling**: Tailwind CSS with custom design system
- **UI Components**: Radix UI primitives with shadcn/ui patterns
- **State Management**: React hooks with cookie persistence
- **External APIs**: Google Sheets API v4, Google Gemini AI
- **Automation**: Browser-use library for job application automation

### Key Application Features
1. **Google Sheets Integration**: Reads job data from sheets using Google Sheets API
2. **Job Filtering**: Advanced filtering by location, skills, salary, date, experience level
3. **Application Tracking**: Track applied/hidden jobs with cookie persistence
4. **Resume Builder**: AI-powered resume generation and customization
5. **Cover Letter Generator**: Automated cover letter creation using Gemini AI
6. **Auto-Apply**: Browser automation for job applications using browser-use
7. **LinkedIn Integration**: Company lookup and contact finding

### Project Structure
- `/app/api/` - API routes for backend functionality
- `/app/components/` - Reusable React components organized by feature
- `/app/types/` - TypeScript type definitions
- `/app/utils/` - Utility functions for data processing
- `/browser-use-0.5.3/` - Browser automation toolkit

## Key Implementation Details

### Google Sheets API Integration
- Uses environment variables for API key and sheet configuration
- Supports multiple industry-specific sheets (Tech, Business, Healthcare, Customer Services)
- Implements data validation and deduplication
- Hard-coded sheet ID: `1dLV3n1XnbyxMaI71JqcWV-4OYnxa9sAl4kBRcST8rjE`

### Data Processing Pipeline
1. Fetch data from Google Sheets API
2. Validate job listings using `validateJobListing()`
3. Deduplicate entries with `dedupJobs()`
4. Apply filters and transformations
5. Cache results in component state with cookie persistence

### State Management Patterns
- Extensive use of `useState` and `useEffect` hooks
- Cookie-based persistence for filters, applied jobs, and user preferences
- Filter state consolidated in `FilterState` interface
- Original row indices preserved for sheet operations

### Component Architecture
- Feature-based component organization (home/, linkedin/, resume/, etc.)
- Shared components for common UI patterns (ActionButton, JobCard, etc.)
- Page-specific components grouped by route

## Configuration Notes

### Environment Variables Required
- `NEXT_PUBLIC_API_KEY` - Google Sheets API key
- `NEXT_PUBLIC_RANGE` - Sheet range pattern with {sheetName} placeholder
- Industry-specific sheet names (TECH, BUSINESS, HEALTHCARE, CUSTOMER)

### Build Configuration
- ESLint and TypeScript errors ignored during build (`ignoreDuringBuilds: true`)
- Turbo bundling enabled for development
- Wildcard image domains allowed for job listing images

### Browser Use Integration
- Located in `/browser-use-0.5.3/` directory
- Python-based automation toolkit
- Contains custom scripts for LinkedIn lookup and job applications

## Development Guidelines

### Code Style (from .cursorrules)
- Use TypeScript for all code with strict typing
- Prefer interfaces over types, avoid enums
- Use functional and declarative patterns
- Follow React 19 best practices (useActionState instead of useFormState)
- Minimize 'use client' directives, prefer Server Components
- Use descriptive naming with auxiliary verbs (isLoading, hasError)

### Component Patterns
- Server Components by default
- Client Components only when needed for interactivity
- Proper error boundaries and Suspense usage
- URL state management with 'nuqs' library

### API Integration
- Async versions of runtime APIs (cookies(), headers(), draftMode())
- Proper async/await handling for params and searchParams
- RESTful API design in route handlers