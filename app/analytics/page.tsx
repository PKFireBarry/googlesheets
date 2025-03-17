"use client"

import { useState, useEffect } from 'react'
import Cookies from 'js-cookie'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area, Treemap, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts'
import { Loader2, Database, Briefcase, Code, Building, MapPin, TrendingUp } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { sendToWebhook } from '../utils/webhook'

const API_KEY = process.env.NEXT_PUBLIC_API_KEY
const RANGE = process.env.NEXT_PUBLIC_RANGE

const extractSpreadsheetId = (url: string) => {
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)
  return match ? match[1] : null
}

// Card component for consistent styling
const Card = ({ 
  children, 
  className = "", 
  title, 
  description, 
  icon 
}: { 
  children: React.ReactNode, 
  className?: string, 
  title: string, 
  description: string, 
  icon: React.ReactNode 
}) => (
  <div className={`bg-[#1E1E1E] border-[#333] text-white shadow-lg rounded-2xl overflow-hidden ${className}`}>
    <div className="pb-2 p-4">
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <h2 className="text-lg font-bold">{title}</h2>
      </div>
      <p className="text-sm text-gray-400">{description}</p>
    </div>
    <div className="p-4 pt-0">
      {children}
    </div>
  </div>
);

// JobSourceBreakdown component
const JobSourceBreakdown = ({ data }: { data: any[] }) => {
  // Extract source information from data (website domains)
  const sources: Record<string, number> = {}
  
  // Extract domain from URLs in the data
  data.forEach((row: any) => {
    let source = 'Unknown'
    
    // Try to extract from company_website field
    const url = row.company_website || row.url || row.link || row.source || ''
    
    if (url) {
      try {
        // Try to extract domain from URL
        const domain = url.toString().match(/^(?:https?:\/\/)?(?:[^@\n]+@)?(?:www\.)?([^:/\n?]+)/im)
        if (domain && domain[1]) {
          // Extract just the domain name without TLD
          const parts = domain[1].split('.')
          if (parts.length >= 2) {
            source = parts[parts.length - 2] // Get the main domain name
            // Capitalize first letter
            source = source.charAt(0).toUpperCase() + source.slice(1)
          } else {
            source = domain[1]
          }
        }
      } catch (e) {
        // If URL parsing fails, use the raw value
        source = url.toString().split('/')[0]
      }
    }
    
    sources[source] = (sources[source] || 0) + 1
  })
  
  const sourceData = Object.entries(sources)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10) // Top 10 sources
  
  const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff8042', '#0088FE', '#00C49F']
  
  return (
    <ResponsiveContainer width="100%" height={200}>
      <PieChart>
        <Pie
          data={sourceData}
          cx="50%"
          cy="50%"
          labelLine={false}
          outerRadius={80}
          fill="#8884d8"
          dataKey="value"
          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
        >
          {sourceData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip contentStyle={{ backgroundColor: '#333', border: 'none' }} itemStyle={{ color: '#fff' }} />
      </PieChart>
    </ResponsiveContainer>
  )
}

// JobTitlesChart component
const JobTitlesChart = ({ titlesData }: { titlesData: any[] }) => {
  const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff8042', '#0088FE', '#00C49F']
  
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart
        data={titlesData}
        margin={{ top: 5, right: 5, left: 5, bottom: 5 }}
        layout="vertical"
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#333" />
        <XAxis type="number" tick={{ fontSize: 10, fill: '#999' }} />
        <YAxis 
          dataKey="name" 
          type="category"
          width={150}
          tick={{ fontSize: 10, fill: '#999' }}
          tickFormatter={(value) => value.length > 25 ? `${value.substring(0, 25)}...` : value}
        />
        <Tooltip contentStyle={{ backgroundColor: '#333', border: 'none' }} itemStyle={{ color: '#fff' }} />
        <Bar dataKey="count" name="Job Count" fill="#8884d8" radius={[0, 4, 4, 0]}>
          {titlesData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

// SummaryStats component
const SummaryStats = ({ data }: { data: any[] }) => {
  // Calculate total jobs
  const totalJobs = data.length
  
  // Calculate jobs added in the last 30 days
  const recentJobs = data.filter(job => {
    const dateField = job.date_posted || job.currentdate || job.date_added || null
    if (!dateField) return false
    
    try {
      const jobDate = new Date(dateField)
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      return jobDate >= thirtyDaysAgo
    } catch (e) {
      return false
    }
  }).length
  
  // Calculate percentage of jobs with salary info
  const jobsWithSalary = data.filter(job => 
    job.salary || job.salary_min || job.salary_max || job.compensation
  ).length
  const salaryPercentage = totalJobs > 0 ? Math.round((jobsWithSalary / totalJobs) * 100) : 0
  
  // Calculate percentage of remote jobs
  const remoteJobs = data.filter(job => {
    const location = (job.location || '').toLowerCase()
    const type = (job.type || job.job_type || '').toLowerCase()
    return location.includes('remote') || type.includes('remote')
  }).length
  const remotePercentage = totalJobs > 0 ? Math.round((remoteJobs / totalJobs) * 100) : 0
  
  return (
    <div className="grid grid-cols-2 gap-2 sm:gap-4">
      <div className="bg-blue-900/30 p-2 sm:p-4 rounded-lg">
        <p className="text-xs sm:text-sm text-blue-300">Total Jobs</p>
        <p className="text-lg sm:text-2xl font-bold text-blue-200">{totalJobs}</p>
      </div>
      <div className="bg-green-900/30 p-2 sm:p-4 rounded-lg">
        <p className="text-xs sm:text-sm text-green-300">Last 30 Days</p>
        <p className="text-lg sm:text-2xl font-bold text-green-200">{recentJobs}</p>
      </div>
      <div className="bg-purple-900/30 p-2 sm:p-4 rounded-lg">
        <p className="text-xs sm:text-sm text-purple-300">With Salary</p>
        <p className="text-lg sm:text-2xl font-bold text-purple-200">{salaryPercentage}%</p>
      </div>
      <div className="bg-amber-900/30 p-2 sm:p-4 rounded-lg">
        <p className="text-xs sm:text-sm text-amber-300">Remote Jobs</p>
        <p className="text-lg sm:text-2xl font-bold text-amber-200">{remotePercentage}%</p>
      </div>
    </div>
  )
}

// SkillsAnalytics component
const SkillsAnalytics = ({ skillsData }: { skillsData: any[] }) => {
  return (
    <>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart
          data={skillsData.slice(0, 10)}
          margin={{ top: 10, right: 5, left: 5, bottom: 5 }}
          layout="vertical"
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#333" />
          <XAxis type="number" tick={{ fill: '#999' }} />
          <YAxis 
            dataKey="name" 
            type="category"
            width={100}
            tick={{ fill: '#999' }}
          />
          <Tooltip 
            contentStyle={{ backgroundColor: '#333', border: 'none' }}
            itemStyle={{ color: '#fff' }}
          />
          <Bar dataKey="count" name="Job Count" fill="#3b82f6" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
      
      {/* Skills List */}
      <div className="mt-6 max-h-96 overflow-y-auto pr-2">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
          {skillsData.slice(0, 50).map((skill, index) => (
            <div key={index} className="flex justify-between items-center bg-[#252525] p-2 rounded">
              <span className="text-sm">{skill.name}</span>
              <span className="text-xs bg-blue-900/40 px-2 py-1 rounded-full text-blue-300">{skill.count}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

// ExperienceLevelsChart component
const ExperienceLevelsChart = ({ experienceData }: { experienceData: any[] }) => {
  // Calculate average experience
  const totalJobs = experienceData.reduce((sum, item) => sum + item.count, 0)
  const weightedSum = experienceData.reduce((sum, item) => {
    // Convert experience level to numeric value for calculation
    let value = 0
    if (item.name === '0-1 years') value = 0.5
    else if (item.name === '2-3 years') value = 2.5
    else if (item.name === '4-5 years') value = 4.5
    else if (item.name === '6-10 years') value = 8
    else if (item.name === '10+ years') value = 12
    
    return sum + (value * item.count)
  }, 0)
  
  const averageExperience = totalJobs > 0 ? (weightedSum / totalJobs).toFixed(1) : 'N/A'
  
  const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff8042', '#0088FE', '#00C49F']
  
  return (
    <div>
      <div className="mb-4 bg-[#252525] p-3 rounded-lg text-center">
        <p className="text-sm text-gray-400">Average Experience Required</p>
        <p className="text-2xl font-bold">{averageExperience} years</p>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={experienceData.filter(d => d.name !== 'Not Specified')}
            cx="50%"
            cy="50%"
            labelLine={false}
            outerRadius={80}
            fill="#8884d8"
            dataKey="count"
            nameKey="name"
            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
          >
            {experienceData.filter(d => d.name !== 'Not Specified').map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip contentStyle={{ backgroundColor: '#333', border: 'none' }} itemStyle={{ color: '#fff' }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<any[]>([])
  const [companyStats, setCompanyStats] = useState<any[]>([])
  const [locationStats, setLocationStats] = useState<any[]>([])
  const [jobTypeStats, setJobTypeStats] = useState<any[]>([])
  const [salaryRangeStats, setSalaryRangeStats] = useState<any[]>([])
  const [appliedStats, setAppliedStats] = useState<{applied: number, notApplied: number}>({applied: 0, notApplied: 0})
  const [timelineData, setTimelineData] = useState<any[]>([])
  const [skillsData, setSkillsData] = useState<any[]>([])
  const [experienceData, setExperienceData] = useState<any[]>([])
  const [jobTitlesData, setJobTitlesData] = useState<any[]>([])
  const [sheetLoaded, setSheetLoaded] = useState(false)
  const router = useRouter()
  
  const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff8042', '#0088FE', '#00C49F']

  useEffect(() => {
    const savedSheetUrl = Cookies.get("lastSheetUrl")
    if (savedSheetUrl) {
      const id = extractSpreadsheetId(savedSheetUrl)
      if (id) {
        setSheetLoaded(true)
        fetchData(id)
      }
    } else {
      // If no Google Sheet URL is set, redirect to home
      router.push('/')
    }
  }, [router])

  const fetchData = async (id: string) => {
    setLoading(true)
    setError(null)
    try {
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${id}/values/${RANGE}?key=${API_KEY}`
      const response = await fetch(url)

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error?.message || "Failed to fetch data")
      }

      const result = await response.json()

      if (!result.values || result.values.length === 0) {
        throw new Error("No data found in sheet")
      }

      const headers = result.values[0]
      const rows = result.values.slice(1)

      // Convert rows to objects with headers as keys
      const processedData = rows.map((row: any[]) => {
        const obj: Record<string, any> = {}
        headers.forEach((header: string, index: number) => {
          obj[header.toLowerCase()] = row[index]
        })
        return obj
      })

      // Process data for analytics
      processData(headers, rows, processedData)
      
    } catch (error: any) {
      console.error("Error fetching data:", error)
      setError(error.message || "Failed to fetch data")
    } finally {
      setLoading(false)
    }
  }

  const processData = (headers: string[], rows: any[], processedData: any[]) => {
    // Find column indices
    const companyIndex = headers.findIndex(h => h.toLowerCase() === 'company_name')
    const locationIndex = headers.findIndex(h => h.toLowerCase() === 'location')
    const jobTypeIndex = headers.findIndex(h => h.toLowerCase() === 'job_type')
    const typeIndex = headers.findIndex(h => h.toLowerCase() === 'type')
    const experienceIndex = headers.findIndex(h => h.toLowerCase() === 'experience')
    const skillsIndex = headers.findIndex(h => h.toLowerCase() === 'skills')
    const urlIndex = headers.findIndex(h => h.toLowerCase() === 'url' || h.toLowerCase() === 'link')
    const titleIndex = headers.findIndex(h => h.toLowerCase() === 'title' || h.toLowerCase() === 'job_title')
    const companyWebsiteIndex = headers.findIndex(h => h.toLowerCase() === 'company_website')
    
    // Store processed data
    setData(processedData)
    
    // Process company statistics
    const companies: Record<string, number> = {}
    rows.forEach(row => {
      const company = companyIndex !== -1 && row[companyIndex] ? row[companyIndex] : 'Unknown'
      companies[company] = (companies[company] || 0) + 1
    })
    
    const companyData = Object.entries(companies)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6) // Top 6 companies
    
    setCompanyStats(companyData)
    
    // Send company data to webhook
    sendToWebhook('company_data', companyData)
    
    // Process location statistics
    const locations: Record<string, number> = {}
    rows.forEach(row => {
      const location = locationIndex !== -1 && row[locationIndex] ? row[locationIndex] : 'Unknown'
      // Simplify location to just the city/state
      const simplifiedLocation = location.split(',')[0].trim()
      locations[simplifiedLocation] = (locations[simplifiedLocation] || 0) + 1
    })
    
    const locationData = Object.entries(locations)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10) // Top 10 locations
    
    setLocationStats(locationData)
    
    // Process job type statistics
    const jobTypes: Record<string, number> = {}
    rows.forEach(row => {
      // Use either job_type or type field
      let jobType = 'Unknown'
      if (jobTypeIndex !== -1 && row[jobTypeIndex]) {
        jobType = row[jobTypeIndex]
      } else if (typeIndex !== -1 && row[typeIndex]) {
        jobType = row[typeIndex]
      }
      
      jobTypes[jobType] = (jobTypes[jobType] || 0) + 1
    })
    
    const jobTypeData = Object.entries(jobTypes)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6) // Limit to top 6 job types
    
    setJobTypeStats(jobTypeData)
    
    // Process job titles
    if (titleIndex !== -1) {
      const titles: Record<string, number> = {}
      
      rows.forEach(row => {
        if (!row[titleIndex]) return
        
        const title = row[titleIndex].toString().trim()
        if (title) {
          titles[title] = (titles[title] || 0) + 1
        }
      })
      
      // Group similar titles
      const groupedTitles: Record<string, number> = {}
      
      Object.entries(titles).forEach(([title, count]) => {
        // Normalize title for grouping
        const lowerTitle = title.toLowerCase()
        
        // Check if this title should be grouped with an existing one
        let matched = false
        for (const [existingTitle, existingCount] of Object.entries(groupedTitles)) {
          const lowerExisting = existingTitle.toLowerCase()
          
          // Check for similarity (contains each other or high overlap)
          if (
            lowerTitle.includes(lowerExisting) || 
            lowerExisting.includes(lowerTitle) ||
            (lowerTitle.split(' ').filter(word => lowerExisting.includes(word)).length >= 2)
          ) {
            // Use the shorter title or the one with higher count
            if (existingTitle.length <= title.length || existingCount > count) {
              groupedTitles[existingTitle] = existingCount + (count as number)
            } else {
              groupedTitles[title] = (existingCount + count as number)
              delete groupedTitles[existingTitle]
            }
            matched = true
            break
          }
        }
        
        if (!matched) {
          groupedTitles[title] = count as number
        }
      })
      
      const titlesData = Object.entries(groupedTitles)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10) // Top 10 job titles
      
      setJobTitlesData(titlesData)
    }
    
    // Process experience levels if available
    if (experienceIndex !== -1) {
      const experienceLevels: Record<string, number> = {
        'Not Specified': 0,
        '0-1 years': 0,
        '2-3 years': 0,
        '4-5 years': 0,
        '6-10 years': 0,
        '10+ years': 0
      }
      
      rows.forEach(row => {
        if (!row[experienceIndex]) {
          experienceLevels['Not Specified']++
          return
        }
        
        const experience = parseInt(row[experienceIndex])
        if (isNaN(experience)) {
          experienceLevels['Not Specified']++
        } else if (experience <= 1) {
          experienceLevels['0-1 years']++
        } else if (experience <= 3) {
          experienceLevels['2-3 years']++
        } else if (experience <= 5) {
          experienceLevels['4-5 years']++
        } else if (experience <= 10) {
          experienceLevels['6-10 years']++
        } else {
          experienceLevels['10+ years']++
        }
      })
      
      // Create experience data
      const expData = Object.entries(experienceLevels)
        .filter(([_, count]) => count > 0)
        .map(([name, count]) => ({ name, count }))
        
      // Sort by experience level
      expData.sort((a, b) => {
        const order = [
          'Not Specified',
          '0-1 years',
          '2-3 years',
          '4-5 years',
          '6-10 years',
          '10+ years'
        ]
        return order.indexOf(a.name) - order.indexOf(b.name)
      })
      
      setExperienceData(expData)
    }
    
    // Process skills if available
    if (skillsIndex !== -1) {
      const skillsMap: Record<string, number> = {}
      
      rows.forEach(row => {
        if (!row[skillsIndex]) return
        
        let skills: string[] = []
        const skillsData = row[skillsIndex]
        
        // Handle different formats of skills data
        if (typeof skillsData === 'string') {
          // Handle comma-separated string
          skills = skillsData.split(',').map((s: string) => s.trim())
        } else if (Array.isArray(skillsData)) {
          // Handle array
          skills = skillsData.map((s: any) => s.toString().trim())
        } else if (typeof skillsData === 'object' && skillsData !== null) {
          // Handle object - extract keys or values
          try {
            const skillsObj = JSON.parse(JSON.stringify(skillsData))
            skills = Object.keys(skillsObj)
          } catch (e) {
            // If parsing fails, try to convert to string
            skills = [String(skillsData)]
          }
        }
        
        // Count each skill
        skills.forEach((skill: string) => {
          if (skill) {
            skillsMap[skill] = (skillsMap[skill] || 0) + 1
          }
        })
      })
      
      // Save skills data for dedicated skills chart
      const skillsChartData = Object.entries(skillsMap)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 50) // Top 50 skills
      
      setSkillsData(skillsChartData)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-black text-white">
        <div className="container mx-auto px-4 py-8">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-[#333] rounded w-1/4"></div>
            <div className="h-4 bg-[#333] rounded w-1/2"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
              <div className="h-64 bg-[#1E1E1E] rounded-2xl"></div>
              <div className="h-64 bg-[#1E1E1E] rounded-2xl"></div>
              <div className="h-64 bg-[#1E1E1E] rounded-2xl"></div>
              <div className="h-64 bg-[#1E1E1E] rounded-2xl"></div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col bg-black text-white">
        <div className="container mx-auto px-4 py-8">
          <div className="bg-red-900/30 border border-red-800 text-red-300 px-4 py-3 rounded-md mb-6">
            <p className="font-medium">Error loading analytics</p>
            <p className="text-sm">{error}</p>
            {!sheetLoaded && (
              <p className="mt-4">Please load a Google Sheet on the home page first.</p>
            )}
          </div>
        </div>
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div className="min-h-screen flex flex-col bg-black text-white">
        <div className="container mx-auto px-4 py-8">
          <div className="bg-yellow-900/30 border border-yellow-800 text-yellow-300 px-4 py-3 rounded-md mb-6">
            <p className="font-medium">No data available</p>
            {!sheetLoaded ? (
              <p className="text-sm">Please load a Google Sheet on the home page first.</p>
            ) : (
              <p className="text-sm">The loaded sheet doesn't contain any valid job data.</p>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col text-white">

      
      <main className="container mx-auto px-4 py-6 mb-10">

        
        {/* Mobile Viewing Instructions */}
        <div className="mb-4 bg-blue-900/20 rounded-lg shadow-md p-3 border border-blue-800 md:hidden">
          <div className="flex items-center gap-2 mb-1">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            <h3 className="text-xs font-medium text-blue-300">Mobile Viewing Tips</h3>
          </div>
          <p className="text-xs text-blue-400">
            Rotate your device to landscape mode for a better view of charts. Tap on chart elements to see detailed information.
          </p>
        </div>
        
        {/* Mobile-friendly layout adjustments */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-6 mb-4 sm:mb-8">
          {/* Summary Stats */}
          <Card 
            title="Summary" 
            description="Key metrics at a glance"
            icon={<Database className="h-5 w-5 text-blue-400" />}
          >
            <SummaryStats data={data} />
          </Card>

          {/* Job Sources - Replacing Application Status */}
          <Card 
            title="Job Sources" 
            description="Where jobs are aggregated from"
            icon={<Database className="h-5 w-5 text-blue-400" />}
          >
            <div className="h-40 sm:h-64">
              <JobSourceBreakdown data={data} />
            </div>
          </Card>
        </div>

        {/* Application Timeline */}
        {timelineData.length > 0 && (
          <Card 
            title="Job Posting Timeline" 
            description="When jobs were posted"
            icon={<TrendingUp className="h-5 w-5 text-green-400" />}
            className="mb-6"
          >
            <div className="h-56 sm:h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={timelineData}
                  margin={{ top: 10, right: 5, left: 5, bottom: 40 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis 
                    dataKey="date" 
                    angle={-45} 
                    textAnchor="end"
                    height={60}
                    interval={0}
                    tick={{ fontSize: 9, fill: '#999' }}
                  />
                  <YAxis tick={{ fontSize: 10, fill: '#999' }} />
                  <Tooltip contentStyle={{ backgroundColor: '#333', border: 'none' }} itemStyle={{ color: '#fff' }} />
                  <Area type="monotone" dataKey="count" name="Job Count" stroke="#8884d8" fill="#8884d8" fillOpacity={0.3} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>
        )}

        {/* Job Titles Chart */}
        <Card 
          title="Top Job Titles" 
          description="Most common job titles in listings"
          icon={<Briefcase className="h-5 w-5 text-purple-400" />}
          className="mb-6"
        >
          <JobTitlesChart titlesData={jobTitlesData} />
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-6 mb-3 sm:mb-6">
          {/* Job Types Chart - Top 6 */}
          <Card 
            title="Job Types" 
            description="Distribution of job types"
            icon={<Briefcase className="h-5 w-5 text-purple-400" />}
          >
            <div className="h-56 sm:h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={jobTypeStats}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="count"
                    nameKey="name"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {jobTypeStats.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#333', border: 'none' }} itemStyle={{ color: '#fff' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Experience Levels Chart with Average */}
          <Card 
            title="Experience Requirements" 
            description="Distribution and average of experience levels"
            icon={<TrendingUp className="h-5 w-5 text-green-400" />}
          >
            <ExperienceLevelsChart experienceData={experienceData} />
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 mb-4 sm:mb-6">
          {/* Top Locations - Horizontal Bar Chart */}
          <Card 
            title="Top Locations" 
            description="Most common job locations"
            icon={<MapPin className="h-5 w-5 text-red-400" />}
          >
            <div className="h-56 sm:h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={locationStats.slice(0, window.innerWidth < 768 ? 5 : 10)}
                  margin={{ top: 5, right: 5, left: 5, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#999' }} />
                  <YAxis tick={{ fontSize: 10, fill: '#999' }} />
                  <Tooltip contentStyle={{ backgroundColor: '#333', border: 'none' }} itemStyle={{ color: '#fff' }} />
                  <Bar dataKey="count" name="Job Count" fill="#00C49F" radius={[4, 4, 0, 0]}>
                    {locationStats.slice(0, window.innerWidth < 768 ? 5 : 10).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={`hsl(${160 - index * 8}, 70%, 50%)`} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Companies Chart */}
          <Card 
            title="Top Companies" 
            description="Companies with the most job listings"
            icon={<Building className="h-5 w-5 text-blue-400" />}
          >
            <div className="h-56 sm:h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={companyStats}
                  margin={{ top: 10, right: 5, left: 5, bottom: 5 }}
                  layout="vertical"
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis type="number" tick={{ fontSize: 10, fill: '#999' }} />
                  <YAxis 
                    dataKey="name" 
                    type="category"
                    width={100}
                    tick={{ fontSize: 10, fill: '#999' }}
                    tickFormatter={(value) => value.length > 12 ? `${value.substring(0, 12)}...` : value}
                  />
                  <Tooltip contentStyle={{ backgroundColor: '#333', border: 'none' }} itemStyle={{ color: '#fff' }} />
                  <Bar dataKey="count" name="Job Count" fill="#0088FE" radius={[0, 4, 4, 0]}>
                    {companyStats.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
        
        {/* Skills Chart with Top 50 Skills List */}
        {skillsData.length > 0 && (
          <Card 
            title="Top Skills in Demand" 
            description="Most in-demand skills from job listings"
            icon={<Code className="h-5 w-5 text-yellow-400" />}
            className="mb-6"
          >
            <SkillsAnalytics skillsData={skillsData} />
          </Card>
        )}
        
        {/* Top Companies as Cards */}
        <div className="p-6 bg-[#1E1E1E] rounded-2xl border border-[#333]">
          <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Building className="h-5 w-5 text-blue-400" />
            Top Companies
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {companyStats.slice(0, 6).map((company, index) => (
              <div key={company.name} className="flex items-center gap-3 p-3 bg-[#252525] rounded-xl">
                <div className="h-10 w-10 rounded-full bg-[#333] flex items-center justify-center text-lg font-bold">
                  {company.name.charAt(0)}
                </div>
                <div>
                  <p className="font-medium">{company.name}</p>
                  <p className="text-sm text-gray-400">{company.count} job{company.count !== 1 ? 's' : ''}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}