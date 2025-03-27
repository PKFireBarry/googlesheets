"use client"

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import MockInterviewContainer from '@/app/components/MockInterviewContainer'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

interface JobData {
  id: string;
  title: string;
  company_name: string;
  description: string;
  location?: string;
  skills?: string;
  [key: string]: string | undefined;
}

// Create a separate client component that uses useSearchParams
function MockInterviewContent() {
  const searchParams = useSearchParams()
  const jobId = searchParams.get('jobId')
  const [jobData, setJobData] = useState<JobData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchJobData = async () => {
      if (!jobId) {
        setLoading(false)
        setError('No job selected. Please select a job from the main page.')
        return
      }

      try {
        // Fetch job data from local storage or session storage
        // In a real implementation, this might come from an API call
        const savedJobs = JSON.parse(localStorage.getItem('savedJobs') || '{}')
        const jobDetails = savedJobs[jobId]

        if (!jobDetails) {
          throw new Error('Job not found')
        }

        setJobData(jobDetails)
      } catch (err) {
        console.error('Error loading job data:', err)
        setError('Failed to load job data. Please try again.')
      } finally {
        setLoading(false)
      }
    }

    fetchJobData()
  }, [jobId])

  return (
    <>
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : error ? (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6 text-center">
          <p className="text-red-700 dark:text-red-400">{error}</p>
          <Link href="/" className="mt-4 inline-block px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
            Go Back to Jobs
          </Link>
        </div>
      ) : (
        <MockInterviewContainer jobData={jobData as JobData} />
      )}
    </>
  )
}

// Main page component with Suspense boundary
export default function MockInterviewPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <Link href="/" className="inline-flex items-center text-blue-600 hover:text-blue-800">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Jobs
        </Link>
      </div>

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          AI Mock Interview
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Practice interviewing with an AI recruiter for this job position. 
          You&apos;ll be asked 3-5 common interview questions and receive feedback on your responses.
        </p>
      </div>

      <Suspense fallback={
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      }>
        <MockInterviewContent />
      </Suspense>
    </div>
  )
} 