"use client"

import { useState, useEffect } from 'react'
import Cookies from 'js-cookie'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area, Treemap, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, LabelList, ReferenceLine } from 'recharts'
import { Loader2, Database, Briefcase, Code, Building, MapPin, TrendingUp, DollarSign, BarChart2, Users, Award, Filter } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

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
    
    // Skip "Unknown" sources
    if (source !== 'Unknown') {
      sources[source] = (sources[source] || 0) + 1
    }
  })
  
  const sourceData = Object.entries(sources)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8) // Limit to top 8 sources to prevent overcrowding
  
  // Create a more consistent and accessible color palette
  const COLORS = [
    '#8884d8', '#82ca9d', '#ffc658', '#ff8042', 
    '#0088FE', '#00C49F', '#FFBB28', '#FF8042'
  ]
  
  const RADIAN = Math.PI / 180
  const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, index, name }: any) => {
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5
    const x = cx + radius * Math.cos(-midAngle * RADIAN)
    const y = cy + radius * Math.sin(-midAngle * RADIAN)
    
    // Only show percentage for segments that are large enough
    return percent > 0.05 ? (
      <text 
        x={x} 
        y={y} 
        fill="#fff" 
        textAnchor="middle" 
        dominantBaseline="central"
        fontSize={12}
        fontWeight="bold"
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    ) : null
  }
  
  return (
    <div>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={sourceData}
            cx="50%"
            cy="50%"
            labelLine={false}
            outerRadius={90}
            fill="#8884d8"
            dataKey="value"
            nameKey="name"
            label={renderCustomizedLabel}
          >
            {sourceData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip 
            contentStyle={{ backgroundColor: '#333', border: 'none', borderRadius: '4px', padding: '8px' }}
            itemStyle={{ color: '#fff' }}
            formatter={(value: any, name: any) => [`${value} jobs`, name]}
          />
          <Legend layout="horizontal" verticalAlign="bottom" align="center" />
        </PieChart>
      </ResponsiveContainer>
      
      {/* Custom legend for better visibility */}
      <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
        {sourceData.map((entry, index) => (
          <div key={`legend-${index}`} className="flex items-center">
            <div 
              className="w-3 h-3 mr-2 rounded-sm" 
              style={{ backgroundColor: COLORS[index % COLORS.length] }}
            ></div>
            <span className="truncate">{entry.name}</span>
            <span className="ml-1 text-gray-400">({entry.value})</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// JobTitlesChart component
const JobTitlesChart = ({ titlesData }: { titlesData: any[] }) => {
  // Create a more consistent color palette
  const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff8042', '#0088FE', '#00C49F']
  
  return (
    <ResponsiveContainer width="100%" height={360}>
      <BarChart
        data={titlesData}
        margin={{ top: 10, right: 5, left: 10, bottom: 50 }}
        layout="vertical"
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#333" />
        <XAxis type="number" tick={{ fontSize: 10, fill: '#999' }} />
        <YAxis 
          dataKey="name" 
          type="category"
          width={170}
          tick={{ fontSize: 11, fill: '#fff' }}
          tickFormatter={(value) => value.length > 30 ? `${value.substring(0, 30)}...` : value}
        />
        <Tooltip 
          contentStyle={{ backgroundColor: '#333', border: 'none', borderRadius: '4px', padding: '8px' }} 
          itemStyle={{ color: '#fff' }}
          formatter={(value: any) => [`${value} jobs`, 'Count']}
          labelFormatter={(label) => `Job Title: ${label}`}
        />
        <Bar dataKey="count" name="Job Count" radius={[0, 4, 4, 0]}>
          {titlesData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
          <LabelList dataKey="count" position="right" fill="#fff" fontSize={10} />
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
  // Create a more consistent color palette
  const COLORS = [
    '#8884d8', '#82ca9d', '#ffc658', '#ff8042', 
    '#0088FE', '#00C49F', '#FFBB28', '#FF8042'
  ]
  
  return (
    <>
      <ResponsiveContainer width="100%" height={360}>
        <BarChart
          data={skillsData.slice(0, 10)}
          margin={{ top: 15, right: 50, left: 10, bottom: 10 }}
          layout="vertical"
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#333" />
          <XAxis type="number" tick={{ fill: '#999' }} />
          <YAxis 
            dataKey="name" 
            type="category"
            width={120}
            tick={{ fill: '#fff', fontSize: 11 }}
          />
          <Tooltip 
            contentStyle={{ backgroundColor: '#333', border: 'none', borderRadius: '4px', padding: '8px' }}
            itemStyle={{ color: '#fff' }}
            formatter={(value: any) => [`${value} job postings`, 'Count']}
            labelFormatter={(label) => `Skill: ${label}`}
          />
          <Bar dataKey="count" name="Job Count" radius={[0, 4, 4, 0]}>
            {skillsData.slice(0, 10).map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
            <LabelList dataKey="count" position="right" fill="#fff" fontSize={10} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      
      {/* Skills List - Improved layout */}
      <div className="mt-6 max-h-96 overflow-y-auto pr-2">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
          {skillsData.slice(0, 50).map((skill, index) => (
            <div 
              key={index} 
              className="flex justify-between items-center bg-[#252525] p-2 rounded hover:bg-[#303030] transition-colors duration-150"
            >
              <span className="text-sm truncate max-w-[75%]" title={skill.name}>{skill.name}</span>
              <span className="text-xs bg-blue-900/40 px-2 py-1 rounded-full text-blue-300 whitespace-nowrap">{skill.count}</span>
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
  
  // Create a more consistent color palette
  const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff8042', '#0088FE', '#00C49F']
  
  // Custom rendering for pie chart labels
  const RADIAN = Math.PI / 180
  const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, index, name }: any) => {
    const radius = innerRadius + (outerRadius - innerRadius) * 1.2
    const x = cx + radius * Math.cos(-midAngle * RADIAN)
    const y = cy + radius * Math.sin(-midAngle * RADIAN)
    
    // Only show percentage for segments that are large enough
    return percent > 0.05 ? (
      <text 
        x={x} 
        y={y} 
        fill="#fff" 
        textAnchor={x > cx ? 'start' : 'end'}
        dominantBaseline="central"
        fontSize={10}
      >
        {`${name}: ${(percent * 100).toFixed(0)}%`}
      </text>
    ) : null
  }
  
  return (
    <div>
      <div className="mb-4 bg-[#252525] p-3 rounded-lg text-center">
        <p className="text-sm text-gray-400">Average Experience Required</p>
        <p className="text-2xl font-bold">{averageExperience} years</p>
      </div>
      <ResponsiveContainer width="100%" height={240}>
        <PieChart>
          <Pie
            data={experienceData.filter(d => d.name !== 'Not Specified')}
            cx="50%"
            cy="50%"
            labelLine={true}
            outerRadius={80}
            fill="#8884d8"
            dataKey="count"
            nameKey="name"
            label={renderCustomizedLabel}
            paddingAngle={2}
          >
            {experienceData.filter(d => d.name !== 'Not Specified').map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip 
            contentStyle={{ backgroundColor: '#333', border: 'none', borderRadius: '4px', padding: '8px' }}
            itemStyle={{ color: '#fff' }}
            formatter={(value: any, name: any) => [`${value} jobs (${((value/totalJobs)*100).toFixed(1)}%)`, name]}
          />
        </PieChart>
      </ResponsiveContainer>
      
      {/* Custom legend for better visibility */}
      <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
        {experienceData.filter(d => d.name !== 'Not Specified').map((entry, index) => (
          <div key={`legend-${index}`} className="flex items-center">
            <div 
              className="w-3 h-3 mr-2 rounded-sm" 
              style={{ backgroundColor: COLORS[index % COLORS.length] }}
            ></div>
            <span>{entry.name}</span>
            <span className="ml-1 text-gray-400">({entry.count})</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// Add these new components for enhanced salary analysis
const SalaryAnalysis = ({ data }: { data: any[] }) => {
  // Prepare salary data for analysis
  const salaryData = data.reduce((acc: any[], job: any) => {
    if (!job.salary) return acc;
    
    const salary = job.salary.toString();
    let parsedSalary = {
      title: job.title || 'Unknown',
      company: job.company_name || 'Unknown',
      skills: job.skills || '',
      location: job.location || 'Unknown',
      min: 0,
      max: 0,
      avg: 0,
      isHourly: false
    };
    
    // Detect if it's hourly or yearly
    let isHourlyRate = salary.toLowerCase().includes('hour') || 
                       salary.toLowerCase().includes('/hr') ||
                       salary.toLowerCase().includes('hourly') ||
                       (salary.includes('$') && salary.includes('/'));
    
    // A reasonable maximum salary cap to prevent outliers (set to $500K)
    const MAX_REASONABLE_SALARY = 500000;
    
    // Handle various salary formats
    if (salary.includes('-')) {
      // Range format: $70,000 - $90,000
      const parts = salary.split('-').map((part: string) => {
        // Extract only the numeric portion
        const numericValue = part.replace(/[^0-9.]/g, '');
        return numericValue ? parseInt(numericValue, 10) : 0;
      });
      
      if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        // For hourly rates, typical values are between $10-$100/hour
        if (isHourlyRate && parts[0] > 500) {
          // This is likely already a yearly salary being mistakenly marked as hourly
          isHourlyRate = false;
        }
        
        // Set reasonable limits for parsed values
        parts[0] = Math.min(parts[0], MAX_REASONABLE_SALARY);
        parts[1] = Math.min(parts[1], MAX_REASONABLE_SALARY);
        
        // Only accept reasonable salary ranges
        if (parts[0] >= 1000 && parts[0] < MAX_REASONABLE_SALARY && 
            parts[1] >= 1000 && parts[1] < MAX_REASONABLE_SALARY) {
          parsedSalary.min = parts[0];
          parsedSalary.max = parts[1];
          parsedSalary.avg = Math.floor((parts[0] + parts[1]) / 2);
          parsedSalary.isHourly = isHourlyRate;
        }
      }
    } else {
      // Single value format: $80,000
      const numericValue = salary.replace(/[^0-9.]/g, '');
      let value = numericValue ? parseInt(numericValue, 10) : 0;
      
      // For hourly rates, typical values are between $10-$100/hour
      if (isHourlyRate && value > 500) {
        // This is likely already a yearly salary being mistakenly marked as hourly
        isHourlyRate = false;
      }
      
      // Cap at reasonable maximum
      value = Math.min(value, MAX_REASONABLE_SALARY);
      
      if (!isNaN(value) && value >= 1000 && value < MAX_REASONABLE_SALARY) {
        parsedSalary.min = value;
        parsedSalary.max = value;
        parsedSalary.avg = value;
        parsedSalary.isHourly = isHourlyRate;
      }
    }
    
    // Convert hourly to yearly for standardization (assuming 2080 hours per year - 40hrs/week * 52 weeks)
    if (parsedSalary.isHourly && parsedSalary.min > 0) {
      // Sanity check: hourly rates are typically $10-$100/hour
      if (parsedSalary.min > 10 && parsedSalary.min < 500) {
        parsedSalary.min *= 2080;
        parsedSalary.max *= 2080;
        parsedSalary.avg *= 2080;
      } else {
        // If outside reasonable hourly rate range, treat as yearly instead
        parsedSalary.isHourly = false;
      }
    }
    
    // Final validation - ensure no salary exceeds our maximum cap
    parsedSalary.min = Math.min(parsedSalary.min, MAX_REASONABLE_SALARY);
    parsedSalary.max = Math.min(parsedSalary.max, MAX_REASONABLE_SALARY);
    parsedSalary.avg = Math.min(parsedSalary.avg, MAX_REASONABLE_SALARY);
    
    // Only add if we have valid salary data that's within reasonable range
    if (parsedSalary.avg > 0 && parsedSalary.avg <= MAX_REASONABLE_SALARY) {
      acc.push(parsedSalary);
    }
    
    return acc;
  }, []);
  
  // Group salary data by ranges for distribution chart
  const salaryRanges = [
    { name: 'Under $50k', min: 0, max: 50000, count: 0 },
    { name: '$50k-$75k', min: 50000, max: 75000, count: 0 },
    { name: '$75k-$100k', min: 75000, max: 100000, count: 0 },
    { name: '$100k-$125k', min: 100000, max: 125000, count: 0 },
    { name: '$125k-$150k', min: 125000, max: 150000, count: 0 },
    { name: '$150k+', min: 150000, max: Infinity, count: 0 }
  ];
  
  salaryData.forEach(job => {
    const range = salaryRanges.find(range => 
      job.avg >= range.min && job.avg < range.max
    );
    if (range) {
      range.count++;
    }
  });
  
  // Calculate overall salary statistics
  const salaryStats = salaryData.reduce((stats, job) => {
    stats.count++;
    stats.total += job.avg;
    stats.min = Math.min(stats.min === 0 ? Infinity : stats.min, job.min);
    stats.max = Math.max(stats.max, job.max);
    return stats;
  }, { count: 0, total: 0, min: 0, max: 0 });
  
  const avgSalary = salaryStats.count > 0 ? 
    Math.floor(salaryStats.total / salaryStats.count) : 0;
  
  // Improved approach for skills salary analysis
  // Track unique job-skill combinations to avoid skills from the same job skewing averages
  type SkillJobSalary = {
    skill: string;
    jobId: string;  // Unique identifier for the job
    salary: number;
  };
  
  const skillSalaryEntries: SkillJobSalary[] = [];
  
  salaryData.forEach(job => {
    if (!job.skills) return;
    
    // Create a unique ID for this job
    const jobId = `${job.title}-${job.company}`.replace(/\s+/g, '-').toLowerCase();
    
    // Create a helper function for cleaning skills
    const cleanSkill = (skill: string): string => {
      return skill
        .replace(/[\[\]"'{}\s]+/g, '') // Remove all brackets, quotes, braces, and whitespace
        .replace(/\\"/g, '') // Remove escaped quotes
        .replace(/^'|'$/g, '') // Remove single quotes
        .trim();
    };
    
    // Parse skills from job using the same approach as in processData
    let skillsList: string[] = [];
    
    try {
      const skillsData = job.skills.toString();
      
      // Skip empty arrays or empty strings
      if (skillsData.trim() === '[]' || skillsData.trim() === '') {
        return; // Skip this job
      }
      
      // First try to parse as JSON if it looks like JSON
      if (skillsData.trim().startsWith('{') || skillsData.trim().startsWith('[')) {
        try {
          const parsed = JSON.parse(skillsData);
          if (Array.isArray(parsed)) {
            skillsList = parsed.map((s: string) => cleanSkill(String(s)))
              .filter((s: string) => s && s.length > 0); // Filter out empty skills
          } else if (typeof parsed === 'object' && parsed !== null) {
            skillsList = Object.keys(parsed)
              .map((s: string) => cleanSkill(String(s)))
              .filter((s: string) => s && s.length > 0); // Filter out empty skills
          }
        } catch {
          // If JSON parsing fails, treat as comma-separated
          skillsList = skillsData.split(',')
            .map((s: string) => cleanSkill(s))
            .filter((s: string) => s && s.length > 0); // Filter out empty skills
        }
      } else {
        // Handle as comma-separated string
        skillsList = skillsData.split(',')
          .map((s: string) => cleanSkill(s))
          .filter((s: string) => s && s.length > 0); // Filter out empty skills
      }
    } catch (e) {
      console.error('Error processing skills in salary analysis:', e);
      return; // Skip this job on error
    }
    
    // Normalize skills
    skillsList = skillsList
      .filter(skill => skill.length > 0)
      .map(skill => skill.charAt(0).toUpperCase() + skill.slice(1).toLowerCase());
    
    // Create a Set to ensure each skill is only counted once per job
    const uniqueSkills = new Set(skillsList);
    
    // Add each skill from this job to the analysis
    uniqueSkills.forEach(skill => {
      if (!skill || skill === '[]') return;
      
      // Add this job-skill-salary combination to our data
      skillSalaryEntries.push({
        skill,
        jobId,
        salary: job.avg
      });
    });
  });
  
  // Group skill-salary data by skill to calculate accurate averages
  const skillAverageSalaries: Record<string, {totalSalary: number, jobCount: number, jobIds: Set<string>}> = {};
  
  skillSalaryEntries.forEach(entry => {
    if (!skillAverageSalaries[entry.skill]) {
      skillAverageSalaries[entry.skill] = {
        totalSalary: 0,
        jobCount: 0,
        jobIds: new Set<string>()
      };
    }
    
    // Only count each job once per skill
    if (!skillAverageSalaries[entry.skill].jobIds.has(entry.jobId)) {
      skillAverageSalaries[entry.skill].jobIds.add(entry.jobId);
      skillAverageSalaries[entry.skill].totalSalary += entry.salary;
      skillAverageSalaries[entry.skill].jobCount++;
    }
  });
  
  // Calculate average salary by skill, filter for skills with enough data points
  const skillSalaryData = Object.entries(skillAverageSalaries)
    .filter(([_, data]) => data.jobCount >= 3) // Require at least 3 data points
    .map(([skill, data]) => ({
      skill,
      avgSalary: Math.floor(data.totalSalary / data.jobCount),
      count: data.jobCount
    }))
    .sort((a, b) => b.avgSalary - a.avgSalary)
    .slice(0, 10); // Top 10 paying skills
  
  // Identify top paying locations
  const locationSalaryMap: Record<string, {count: number, total: number}> = {};
  
  salaryData.forEach(job => {
    if (!job.location) return;
    
    // Simple location parsing - just use the first part (city/state)
    const location = job.location.toString().split(',')[0].trim();
    
    if (!location) return;
    if (!locationSalaryMap[location]) {
      locationSalaryMap[location] = { count: 0, total: 0 };
    }
    locationSalaryMap[location].count++;
    locationSalaryMap[location].total += job.avg;
  });
  
  // Calculate average salary by location, filter for locations with enough data
  const locationSalaryData = Object.entries(locationSalaryMap)
    .filter(([_, data]) => data.count >= 2) // Require at least 2 data points
    .map(([location, data]) => ({
      location,
      avgSalary: Math.floor(data.total / data.count),
      count: data.count
    }))
    .sort((a, b) => b.avgSalary - a.avgSalary)
    .slice(0, 5); // Top 5 paying locations
  
  return (
    <div className="space-y-6">
      {/* Salary distribution chart */}
      <div>
        <h4 className="text-sm font-medium text-gray-300 mb-3">Salary Distribution</h4>
        <ResponsiveContainer width="100%" height={230}>
          <BarChart data={salaryRanges} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#fff' }} />
            <YAxis tick={{ fontSize: 10, fill: '#999' }} />
            <Tooltip 
              contentStyle={{ backgroundColor: '#333', border: 'none', borderRadius: '4px', padding: '8px' }}
              itemStyle={{ color: '#fff' }}
              formatter={(value: any) => [`${value} jobs`, 'Count']}
            />
            <Bar dataKey="count" name="Jobs" fill="#8884d8">
              {salaryRanges.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={`hsl(${260 - index * 30}, 70%, 60%)`} />
              ))}
              <LabelList dataKey="count" position="top" fill="#fff" fontSize={10} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      
      {/* Salary statistics summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-purple-900/30 p-3 rounded-lg">
          <p className="text-xs text-purple-300">Average Salary</p>
          <p className="text-lg font-bold text-purple-200">
            ${avgSalary.toLocaleString()}
          </p>
        </div>
        <div className="bg-blue-900/30 p-3 rounded-lg">
          <p className="text-xs text-blue-300">Min Salary</p>
          <p className="text-lg font-bold text-blue-200">
            ${salaryStats.min.toLocaleString()}
          </p>
        </div>
        <div className="bg-green-900/30 p-3 rounded-lg">
          <p className="text-xs text-green-300">Max Salary</p>
          <p className="text-lg font-bold text-green-200">
            ${salaryStats.max.toLocaleString()}
          </p>
        </div>
      </div>
      
      {/* Top paying skills */}
      {skillSalaryData.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-300 mb-2">Top Paying Skills</h4>
          <div className="space-y-2">
            {skillSalaryData.map((item, index) => (
              <div key={index} className="flex justify-between items-center rounded-lg bg-[#252525] p-2">
                <span className="text-sm font-medium">{item.skill}</span>
                <div className="flex items-center">
                  <span className="text-sm text-green-300">${item.avgSalary.toLocaleString()}</span>
                  <span className="text-xs text-gray-400 ml-2">({item.count} jobs)</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Top paying locations */}
      {locationSalaryData.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-300 mb-2">Top Paying Locations</h4>
          <div className="space-y-2">
            {locationSalaryData.map((item, index) => (
              <div key={index} className="flex justify-between items-center rounded-lg bg-[#252525] p-2">
                <span className="text-sm font-medium">{item.location}</span>
                <div className="flex items-center">
                  <span className="text-sm text-green-300">${item.avgSalary.toLocaleString()}</span>
                  <span className="text-xs text-gray-400 ml-2">({item.count} jobs)</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// Define proper types for the data structures
// Add this near the top with the other type definitions
type MonthDataPoint = [string, number]; // [monthKey, count]

// New component for skill insights
const SkillInsights = ({ skillsData, data }: { skillsData: any[], data: any[] }) => {
  // Extract job titles and their skill requirements for correlation
  const titleSkillMap: Record<string, string[]> = {};
  
  data.forEach(job => {
    if (!job.title || !job.skills) return;
    
    const title = job.title.toString();
    const skills = job.skills.toString().split(',')
      .map((s: string) => s.trim())
      .filter((s: string) => s);
    
    if (!titleSkillMap[title]) {
      titleSkillMap[title] = [];
    }
    
    skills.forEach((skill: string) => {
      if (!titleSkillMap[title].includes(skill)) {
        titleSkillMap[title].push(skill);
      }
    });
  });
  
  // Find commonly paired skills (skills that appear together often)
  const skillPairs: Record<string, number> = {};
  
  Object.values(titleSkillMap).forEach(skillList => {
    for (let i = 0; i < skillList.length; i++) {
      for (let j = i + 1; j < skillList.length; j++) {
        // Create a consistent key for the skill pair
        const pair = [skillList[i], skillList[j]].sort().join('||');
        skillPairs[pair] = (skillPairs[pair] || 0) + 1;
      }
    }
  });
  
  // Get top skill pairs
  const topPairs = Object.entries(skillPairs)
    .map(([pair, count]) => {
      const [skill1, skill2] = pair.split('||');
      return { skill1, skill2, count };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);
  
  // Calculate skill demand growth (approximation based on job posting dates)
  const skillGrowth: Record<string, MonthDataPoint[]> = {};
  
  // Only process if we have date information
  const hasDateData = data.some(job => job.date_posted || job.currentdate || job.currentDate);
  
  if (hasDateData) {
    // Group skills by month
    data.forEach(job => {
      const dateStr = job.date_posted || job.currentdate || job.currentDate;
      if (!dateStr || !job.skills) return;
      
      try {
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return;
        
        // Use month as the time unit
        const monthKey = `${date.getFullYear()}-${date.getMonth() + 1}`;
        
        const skills = job.skills.toString().split(',')
          .map((s: string) => s.trim())
          .filter((s: string) => s);
        
        skills.forEach((skill: string) => {
          if (!skillGrowth[skill]) {
            skillGrowth[skill] = [];
          }
          
          // Record occurrence in this month
          const monthIndex = skillGrowth[skill].findIndex(
            (m: MonthDataPoint) => m[0] === monthKey
          );
          
          if (monthIndex >= 0) {
            skillGrowth[skill][monthIndex][1]++;
          } else {
            skillGrowth[skill].push([monthKey, 1]);
          }
        });
      } catch (e) {
        console.error('Error processing date:', e);
      }
    });
  }
  
  // Calculate growth rates for top skills
  const growthData = skillsData.slice(0, 10).map(({ name }) => {
    const monthCounts: MonthDataPoint[] = skillGrowth[name] || [];
    
    // Sort by month
    const sortedMonthCounts = [...monthCounts].sort((a, b) => 
      a[0].localeCompare(b[0])
    );
    
    // Calculate growth rate if we have enough data points
    let growthRate = 0;
    if (sortedMonthCounts.length >= 2) {
      // Simple growth calculation: (latest - earliest) / earliest
      const earliest = sortedMonthCounts[0][1];
      const latest = sortedMonthCounts[sortedMonthCounts.length - 1][1];
      
      if (earliest > 0) {
        growthRate = (latest - earliest) / earliest;
      }
    }
    
    return {
      skill: name,
      growthRate,
      trend: growthRate > 0.1 ? 'rising' : growthRate < -0.1 ? 'falling' : 'stable'
    };
  });
  
  return (
    <div className="space-y-6">
      {/* Top skills visualization - already provided by existing SkillsAnalytics */}
      <div className="mt-6">
        <h4 className="text-sm font-medium text-gray-300 mb-3">Skill Demand Insights</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Skill trends */}
          <div className="bg-[#252525] p-4 rounded-lg">
            <h5 className="text-sm font-medium text-gray-300 mb-2">Skill Demand Trends</h5>
            <div className="space-y-2">
              {growthData.map((item, index) => (
                <div key={index} className="flex justify-between items-center">
                  <span className="text-sm">{item.skill}</span>
                  <span className={`text-xs font-medium px-2 py-1 rounded ${
                    item.trend === 'rising' ? 'bg-green-900/40 text-green-300' :
                    item.trend === 'falling' ? 'bg-red-900/40 text-red-300' :
                    'bg-gray-800 text-gray-300'
                  }`}>
                    {item.trend === 'rising' ? '↑ Rising' :
                     item.trend === 'falling' ? '↓ Falling' : '→ Stable'}
                  </span>
                </div>
              ))}
            </div>
          </div>
          
          {/* Complementary skills */}
          <div className="bg-[#252525] p-4 rounded-lg">
            <h5 className="text-sm font-medium text-gray-300 mb-2">Complementary Skills</h5>
            <div className="space-y-2">
              {topPairs.map((pair, index) => (
                <div key={index} className="text-sm">
                  <span className="bg-blue-900/30 text-blue-300 px-2 py-1 rounded">{pair.skill1}</span>
                  <span className="mx-2 text-gray-400">+</span>
                  <span className="bg-purple-900/30 text-purple-300 px-2 py-1 rounded">{pair.skill2}</span>
                  <span className="text-xs text-gray-400 ml-2">({pair.count} jobs)</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      
      {/* Skill market advice */}
      <div className="bg-[#252525] p-4 rounded-lg">
        <h5 className="text-sm font-medium text-gray-300 mb-2">Market Recommendations</h5>
        <ul className="space-y-2 text-sm text-gray-300">
          <li className="flex">
            <span className="text-green-400 mr-2">•</span>
            <span>Focus on complementary skill pairs to maximize job opportunities</span>
          </li>
          <li className="flex">
            <span className="text-green-400 mr-2">•</span>
            <span>Rising skills are excellent investment for learning/development</span>
          </li>
          <li className="flex">
            <span className="text-green-400 mr-2">•</span>
            <span>Most in-demand skills appear across multiple job titles, showing their versatility</span>
          </li>
        </ul>
      </div>
    </div>
  );
};

// Job Market Insights component
const JobMarketInsights = ({ data }: { data: any[] }) => {
  // Calculate job posting trends by date
  const jobsByDate: Record<string, number> = {};
  
  data.forEach(job => {
    const dateStr = job.date_posted || job.currentdate || job.currentDate;
    if (!dateStr) return;
    
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return;
      
      // Group by month for trend analysis
      const monthKey = `${date.getFullYear()}-${date.getMonth() + 1}`;
      jobsByDate[monthKey] = (jobsByDate[monthKey] || 0) + 1;
    } catch (e) {
      console.error('Error processing date:', e);
    }
  });
  
  // Convert to array and sort by date
  const jobTrends = Object.entries(jobsByDate)
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));
  
  // Calculate month-over-month growth for the last few months
  let growthRate = 0;
  if (jobTrends.length >= 2) {
    const lastMonth = jobTrends[jobTrends.length - 1].count;
    const previousMonth = jobTrends[jobTrends.length - 2].count;
    
    if (previousMonth > 0) {
      growthRate = ((lastMonth - previousMonth) / previousMonth) * 100;
    }
  }
  
  // Identify if the job market is growing, stable, or declining
  const marketStatus = 
    growthRate > 5 ? 'growing' :
    growthRate < -5 ? 'declining' :
    'stable';
  
  // Market competitiveness - more data points per title suggests competition
  const jobTitlesMap: Record<string, number> = {};
  
  data.forEach(job => {
    if (!job.title) return;
    
    const title = job.title.toString().trim();
    if (title) {
      jobTitlesMap[title] = (jobTitlesMap[title] || 0) + 1;
    }
  });
  
  // Calculate competitiveness metrics
  const titleCounts = Object.values(jobTitlesMap);
  const avgJobsPerTitle = titleCounts.length > 0 ? 
    titleCounts.reduce((sum, count) => sum + count, 0) / titleCounts.length : 0;
  
  // Market competitiveness level
  const competitiveness = 
    avgJobsPerTitle > 5 ? 'high' :
    avgJobsPerTitle > 2 ? 'medium' :
    'low';
  
  return (
    <div className="space-y-6">
      {/* Market status overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className={`p-4 rounded-lg ${
          marketStatus === 'growing' ? 'bg-green-900/30' :
          marketStatus === 'declining' ? 'bg-red-900/30' :
          'bg-blue-900/30'
        }`}>
          <h4 className="text-sm font-medium mb-1">Market Trend</h4>
          <div className="flex items-center">
            <span className={`text-lg font-bold ${
              marketStatus === 'growing' ? 'text-green-300' :
              marketStatus === 'declining' ? 'text-red-300' :
              'text-blue-300'
            }`}>
              {marketStatus === 'growing' ? '↑' :
               marketStatus === 'declining' ? '↓' : '→'}
              {' '}
              {marketStatus.charAt(0).toUpperCase() + marketStatus.slice(1)}
            </span>
            {growthRate !== 0 && (
              <span className="ml-2 text-sm">
                ({growthRate.toFixed(1)}%)
              </span>
            )}
          </div>
        </div>
        
        <div className="p-4 rounded-lg bg-purple-900/30">
          <h4 className="text-sm font-medium mb-1">Competition Level</h4>
          <div className="flex items-center">
            <span className="text-lg font-bold text-purple-300">
              {competitiveness.charAt(0).toUpperCase() + competitiveness.slice(1)}
            </span>
            <span className="ml-2 text-sm">
              ({avgJobsPerTitle.toFixed(1)} jobs/title)
            </span>
          </div>
        </div>
        
        <div className="p-4 rounded-lg bg-amber-900/30">
          <h4 className="text-sm font-medium mb-1">Total Data Points</h4>
          <div className="flex items-center">
            <span className="text-lg font-bold text-amber-300">
              {data.length} jobs
            </span>
          </div>
        </div>
      </div>
      
      {/* Market insights */}
      <div className="bg-[#252525] p-4 rounded-lg">
        <h4 className="text-sm font-medium text-gray-300 mb-2">Job Seeker Action Items</h4>
        <ul className="space-y-2 text-sm text-gray-300">
          {marketStatus === 'growing' ? (
            <>
              <li className="flex">
                <span className="text-green-400 mr-2">•</span>
                <span>Market is expanding - good time to negotiate higher salaries</span>
              </li>
              <li className="flex">
                <span className="text-green-400 mr-2">•</span>
                <span>Apply quickly as job openings are increasing</span>
              </li>
            </>
          ) : marketStatus === 'declining' ? (
            <>
              <li className="flex">
                <span className="text-yellow-400 mr-2">•</span>
                <span>Market is contracting - focus on differentiation and networking</span>
              </li>
              <li className="flex">
                <span className="text-yellow-400 mr-2">•</span>
                <span>Consider roles with stable companies and industries</span>
              </li>
            </>
          ) : (
            <li className="flex">
              <span className="text-blue-400 mr-2">•</span>
              <span>Market is stable - focus on quality applications over quantity</span>
            </li>
          )}
          
          {competitiveness === 'high' ? (
            <li className="flex">
              <span className="text-yellow-400 mr-2">•</span>
              <span>High competition - highlight unique aspects of your experience</span>
            </li>
          ) : competitiveness === 'low' ? (
            <li className="flex">
              <span className="text-green-400 mr-2">•</span>
              <span>Low competition - good opportunity to apply for stretch roles</span>
            </li>
          ) : (
            <li className="flex">
              <span className="text-blue-400 mr-2">•</span>
              <span>Moderate competition - balanced approach to job search recommended</span>
            </li>
          )}
        </ul>
      </div>
      
      {/* Job posting trend chart */}
      {jobTrends.length > 1 && (
        <div>
          <h4 className="text-sm font-medium text-gray-300 mb-2">Job Posting Trend</h4>
          <ResponsiveContainer width="100%" height={230}>
            <AreaChart 
              data={jobTrends}
              margin={{ top: 10, right: 10, left: 5, bottom: 5 }}
            >
              <defs>
                <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#8884d8" stopOpacity={0.2}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis 
                dataKey="date" 
                tick={{ fontSize: 10, fill: '#fff' }}
                tickFormatter={(value) => {
                  const [year, month] = value.split('-');
                  return `${month}/${year.slice(2)}`;
                }}
              />
              <YAxis 
                tick={{ fontSize: 10, fill: '#999' }} 
                allowDecimals={false}
              />
              <Tooltip 
                contentStyle={{ backgroundColor: '#333', border: 'none', borderRadius: '4px', padding: '8px' }}
                itemStyle={{ color: '#fff' }}
                labelFormatter={(value) => {
                  const [year, month] = value.split('-');
                  const date = new Date(parseInt(year), parseInt(month) - 1);
                  return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
                }}
                formatter={(value: any) => [`${value} jobs`, 'Job Count']}
              />
              <Area 
                type="monotone" 
                dataKey="count" 
                name="Job Count" 
                stroke="#8884d8" 
                fill="url(#colorCount)" 
                activeDot={{ r: 6 }}
              />
              
              {/* Add reference line for average */}
              {jobTrends.length > 0 && (
                <ReferenceLine 
                  y={jobTrends.reduce((sum, item) => sum + item.count, 0) / jobTrends.length} 
                  stroke="#ff7300" 
                  strokeDasharray="3 3"
                  label={{ 
                    value: 'Average', 
                    position: 'right', 
                    fill: '#ff7300', 
                    fontSize: 10 
                  }}
                />
              )}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};

// Add Tab component for organizing content
const Tab = ({ 
  active, 
  onClick, 
  children, 
  icon 
}: { 
  active: boolean, 
  onClick: () => void, 
  children: React.ReactNode, 
  icon?: React.ReactNode 
}) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t-lg transition-colors
    ${active 
      ? 'bg-[#1E1E1E] text-white border-t border-l border-r border-[#333]' 
      : 'bg-[#111] text-gray-400 hover:bg-[#1A1A1A] hover:text-gray-300'}`}
  >
    {icon}
    {children}
  </button>
);

// Add KeyInsight component for summary section
const KeyInsight = ({ 
  title, 
  value, 
  trend, 
  icon 
}: { 
  title: string, 
  value: string | number, 
  trend?: 'up' | 'down' | 'neutral', 
  icon: React.ReactNode 
}) => (
  <div className="bg-[#1A1A1A] rounded-lg p-3 border border-[#333] flex items-center">
    <div className="mr-3 p-2 rounded-full bg-[#2A2A2A]">
      {icon}
    </div>
    <div>
      <h3 className="text-xs text-gray-400">{title}</h3>
      <div className="flex items-center">
        <p className="text-lg font-bold">{value}</p>
        {trend && (
          <span className={`ml-2 text-xs ${
            trend === 'up' ? 'text-green-400' : 
            trend === 'down' ? 'text-red-400' : 
            'text-gray-400'
          }`}>
            {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'}
          </span>
        )}
      </div>
    </div>
  </div>
);

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
  
  // Add active tab state
  const [activeTab, setActiveTab] = useState('overview')
  
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
      // Skip 'Unknown' companies
      if (company !== 'Unknown') {
        companies[company] = (companies[company] || 0) + 1
      }
    })
    
    const companyData = Object.entries(companies)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6) // Top 6 companies
    
    setCompanyStats(companyData)
    
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
    
    // Process skills
    if (skillsIndex !== -1) {
      const skillsMap: Record<string, number> = {};
      
      rows.forEach(row => {
        if (skillsIndex !== -1 && row[skillsIndex]) {
          const skillsData = row[skillsIndex];
          let skills: string[] = [];
          
          const cleanSkill = (skill: string): string => {
            // Remove common JSON artifacts and clean the string
            return skill
              .replace(/[\[\]"'{}\s]+/g, '') // Remove all brackets, quotes, braces, and whitespace
              .replace(/\\"/g, '') // Remove escaped quotes
              .replace(/^'|'$/g, '') // Remove single quotes
              .trim();
          };

          try {
            if (typeof skillsData === 'string') {
              // Skip empty arrays or empty strings
              if (skillsData.trim() === '[]' || skillsData.trim() === '') {
                return; // Skip this row
              }
              
              // First try to parse as JSON if it looks like JSON
              if (skillsData.trim().startsWith('{') || skillsData.trim().startsWith('[')) {
                try {
                  const parsed = JSON.parse(skillsData);
                  if (Array.isArray(parsed)) {
                    skills = parsed.map((s: string) => cleanSkill(String(s)))
                      .filter((s: string) => s && s.length > 0); // Filter out empty skills
                  } else if (typeof parsed === 'object' && parsed !== null) {
                    skills = Object.keys(parsed)
                      .map((s: string) => cleanSkill(String(s)))
                      .filter((s: string) => s && s.length > 0); // Filter out empty skills
                  }
                } catch {
                  // If JSON parsing fails, treat as comma-separated
                  skills = skillsData.split(',')
                    .map((s: string) => cleanSkill(s))
                    .filter((s: string) => s && s.length > 0); // Filter out empty skills
                }
              } else {
                // Handle as comma-separated string
                skills = skillsData.split(',')
                  .map((s: string) => cleanSkill(s))
                  .filter((s: string) => s && s.length > 0); // Filter out empty skills
              }
            } else if (Array.isArray(skillsData)) {
              skills = skillsData
                .map((s: string) => cleanSkill(String(s)))
                .filter((s: string) => s && s.length > 0); // Filter out empty skills
            } else if (typeof skillsData === 'object' && skillsData !== null) {
              skills = Object.keys(skillsData)
                .map((s: string) => cleanSkill(String(s)))
                .filter((s: string) => s && s.length > 0); // Filter out empty skills
            }

            // Filter out empty skills and normalize
            skills = skills
              .filter(skill => skill.length > 0)
              .map(skill => {
                // Normalize case (first letter uppercase, rest lowercase)
                return skill.charAt(0).toUpperCase() + skill.slice(1).toLowerCase();
              });
              
            // Count each skill
            skills.forEach((skill: string) => {
              if (skill) {
                skillsMap[skill] = (skillsMap[skill] || 0) + 1
              }
            })
          } catch (e) {
            console.error('Error processing skills:', e)
          }
        }
      })
      
      // Save skills data for dedicated skills chart
      const skillsChartData = Object.entries(skillsMap)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .filter(({ name }) => name.length > 1 && name !== '[]') // Filter out single-character skills and empty arrays
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

  // Calculate key metrics for the insights section
  const totalJobs = data.length;
  
  // Recent jobs (last 30 days)
  const recentJobs = data.filter(job => {
    const dateField = job.date_posted || job.currentdate || job.date_added || null;
    if (!dateField) return false;
    
    try {
      const jobDate = new Date(dateField);
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      return jobDate >= thirtyDaysAgo;
    } catch (e) {
      return false;
    }
  }).length;
  
  // Average salary calculation
  const validSalaries = data.reduce((acc: number[], job: any) => {
    if (job.salary) {
      const salary = job.salary.toString();
      const numericValue = parseInt(salary.replace(/[^0-9]/g, ''));
      
      if (!isNaN(numericValue) && numericValue > 10000 && numericValue < 500000) {
        acc.push(numericValue);
      }
    }
    return acc;
  }, []);
  
  const avgSalary = validSalaries.length > 0 
    ? Math.floor(validSalaries.reduce((sum, salary) => sum + salary, 0) / validSalaries.length)
    : 0;
  
  // Top skill
  const topSkill = skillsData.length > 0 ? skillsData[0].name : 'N/A';
  
  return (
    <div className="min-h-screen flex flex-col text-white">
      <main className="container mx-auto px-4 py-6 mb-10">
        <h2 className="text-xl font-bold mb-6">Job Market Analytics</h2>
        
        {/* Key Insights Section */}
        <div className="bg-[#1E1E1E] border border-[#333] rounded-lg p-4 mb-6">
          <h3 className="text-sm text-gray-400 mb-3">Key Insights</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KeyInsight 
              title="Total Jobs" 
              value={totalJobs} 
              icon={<Briefcase className="h-4 w-4 text-blue-400" />} 
            />
            <KeyInsight 
              title="Last 30 Days" 
              value={recentJobs} 
              trend={recentJobs > totalJobs / 12 ? 'up' : 'down'}
              icon={<TrendingUp className="h-4 w-4 text-green-400" />} 
            />
            <KeyInsight 
              title="Avg Salary" 
              value={`$${avgSalary.toLocaleString()}`} 
              icon={<DollarSign className="h-4 w-4 text-amber-400" />} 
            />
            <KeyInsight 
              title="Top Skill" 
              value={topSkill} 
              icon={<Award className="h-4 w-4 text-purple-400" />} 
            />
          </div>
        </div>
        
        {/* Tabs Navigation */}
        <div className="flex overflow-x-auto mb-1 border-b border-[#333]">
          <Tab 
            active={activeTab === 'overview'} 
            onClick={() => setActiveTab('overview')}
            icon={<BarChart2 className="h-4 w-4" />}
          >
            Market Overview
          </Tab>
          <Tab 
            active={activeTab === 'salary'} 
            onClick={() => setActiveTab('salary')}
            icon={<DollarSign className="h-4 w-4" />}
          >
            Salary Data
          </Tab>
          <Tab 
            active={activeTab === 'skills'} 
            onClick={() => setActiveTab('skills')}
            icon={<Code className="h-4 w-4" />}
          >
            Skills Analysis
          </Tab>
          <Tab 
            active={activeTab === 'companies'} 
            onClick={() => setActiveTab('companies')}
            icon={<Building className="h-4 w-4" />}
          >
            Companies & Location
          </Tab>
        </div>
        
        {/* Tab Content */}
        <div className="bg-[#1E1E1E] border-x border-b border-[#333] rounded-b-lg p-6">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <Card 
                title="Market Overview" 
                description="Key metrics at a glance"
                icon={<Database className="h-5 w-5 text-blue-400" />}
              >
                <SummaryStats data={data} />
              </Card>
              
              <Card 
                title="Job Market Insights" 
                description="Actionable market trends and recommendations"
                icon={<TrendingUp className="h-5 w-5 text-green-400" />}
              >
                <JobMarketInsights data={data} />
              </Card>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card 
                  title="Experience Requirements" 
                  description="Distribution of experience levels"
                  icon={<Users className="h-5 w-5 text-green-400" />}
                >
                  <ExperienceLevelsChart experienceData={experienceData} />
                </Card>
                
                <Card 
                  title="Job Sources" 
                  description="Where jobs are aggregated from"
                  icon={<Database className="h-5 w-5 text-blue-400" />}
                >
                  <JobSourceBreakdown data={data} />
                </Card>
              </div>
            </div>
          )}
          
          {/* Salary Tab */}
          {activeTab === 'salary' && (
            <div className="space-y-6">
              <Card 
                title="Salary Analysis" 
                description="Compensation trends and insights"
                icon={<DollarSign className="h-5 w-5 text-green-400" />}
              >
                <SalaryAnalysis data={data} />
              </Card>
            </div>
          )}
          
          {/* Skills Tab */}
          {activeTab === 'skills' && (
            <div className="space-y-6">
              <Card 
                title="Skills Insights" 
                description="In-demand skills and market value"
                icon={<Code className="h-5 w-5 text-yellow-400" />}
              >
                <div className="flex flex-col space-y-6">
                  <SkillsAnalytics skillsData={skillsData} />
                  <SkillInsights skillsData={skillsData} data={data} />
                </div>
              </Card>
            </div>
          )}
          
          {/* Companies & Location Tab */}
          {activeTab === 'companies' && (
            <div className="space-y-6">
              <Card 
                title="Top Job Titles" 
                description="Most common job titles in listings"
                icon={<Briefcase className="h-5 w-5 text-purple-400" />}
              >
                <JobTitlesChart titlesData={jobTitlesData} />
              </Card>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card 
                  title="Top Companies" 
                  description="Companies with the most job listings"
                  icon={<Building className="h-5 w-5 text-blue-400" />}
                >
                  <div className="grid grid-cols-1 gap-2">
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
                </Card>
                
                <Card 
                  title="Top Locations" 
                  description="Most common job locations"
                  icon={<MapPin className="h-5 w-5 text-red-400" />}
                >
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={locationStats.slice(0, 5)}
                        margin={{ top: 5, right: 5, left: 5, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                        <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#999' }} />
                        <YAxis tick={{ fontSize: 10, fill: '#999' }} />
                        <Tooltip contentStyle={{ backgroundColor: '#333', border: 'none' }} itemStyle={{ color: '#fff' }} />
                        <Bar dataKey="count" name="Job Count" fill="#00C49F" radius={[4, 4, 0, 0]}>
                          {locationStats.slice(0, 5).map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={`hsl(${160 - index * 8}, 70%, 50%)`} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}