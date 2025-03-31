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
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500"></div>
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
    <div className="max-w-6xl mx-auto px-3 sm:px-6 py-4 sm:py-8">
      <div className="mb-4 sm:mb-6">
        <Link href="/" className="inline-flex items-center text-blue-600 hover:text-blue-800">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Jobs
        </Link>
      </div>

      <div className="mb-4 sm:mb-8">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-xl shadow-lg p-4 sm:p-6 text-white">
          <h1 className="text-xl sm:text-3xl font-bold">
            AI Mock Interview
          </h1>
          <p className="mt-2 text-sm sm:text-base text-blue-100">
            Practice interviewing with an AI recruiter for this job position. 
            You'll be asked questions based on the job requirements and receive feedback on your responses.
          </p>
        </div>
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