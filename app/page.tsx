"use client"

import type React from "react"

import { useState, useRef, type Key, useEffect } from "react"
import {
  ChevronLeft,
  ChevronRight,
  MapPin,
  Building,
  Clock,
  Briefcase,
  DollarSign,
  Trash2,
  CheckCircle,
  Filter,
  Globe,
} from "lucide-react"
import clsx from "clsx"
import Cookies from "js-cookie"

const API_KEY = process.env.NEXT_PUBLIC_API_KEY
const RANGE = process.env.NEXT_PUBLIC_RANGE

const extractSpreadsheetId = (url: string) => {
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)
  return match ? match[1] : null
}

const validateJobListing = (row: string[], headers: string[]) => {
  const getFieldValue = (fieldName: string) => {
    const index = headers.findIndex((header) => header.toLowerCase() === fieldName.toLowerCase())
    return index !== -1 ? row[index] : ""
  }

  return Boolean(
    getFieldValue("title")?.trim() && getFieldValue("description")?.trim() && getFieldValue("company_name")?.trim(),
  )
}

const cn = (...classes: (string | boolean | undefined)[]) => {
  return clsx(classes)
}

interface RowData {
  data: string[];
  originalIndex: number;
}

export default function Home() {
  const [data, setData] = useState<string[][]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentIndex, setCurrentIndex] = useState(1)
  const [startX, setStartX] = useState<number | null>(null)
  const [offsetX, setOffsetX] = useState(0)
  const [sheetUrl, setSheetUrl] = useState("")
  const [spreadsheetId, setSpreadsheetId] = useState("")
  const cardRef = useRef<HTMLDivElement | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [appliedJobs, setAppliedJobs] = useState<string[]>(() => {
    const saved = Cookies.get("appliedJobs")
    return saved ? JSON.parse(saved) : []
  })
  const [isNotesOpen, setIsNotesOpen] = useState(false)
  const [rowIndices, setRowIndices] = useState<number[]>([])
  const [totalSheetRows, setTotalSheetRows] = useState<number>(0)
  const [activeFilters, setActiveFilters] = useState<
    Array<{
      field: string
      value: string
      type: "include" | "exclude"
    }>
  >(() => {
    const saved = Cookies.get("activeFilters")
    return saved ? JSON.parse(saved) : []
  })

  useEffect(() => {
    const savedSheetUrl = Cookies.get("lastSheetUrl")
    if (savedSheetUrl) {
      setSheetUrl(savedSheetUrl)
      const id = extractSpreadsheetId(savedSheetUrl)
      if (id) {
        setSpreadsheetId(id)
        fetchData(id)
      }
    }
  }, []) // Remove fetchData from dependency array since it hasn't been defined yet

  const handleUrlSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const id = extractSpreadsheetId(sheetUrl)
    console.log("Extracted ID:", id)
    if (id) {
      setSpreadsheetId(id)
      Cookies.set("lastSheetUrl", sheetUrl, { expires: 30 }) // Save URL in cookie for 30 days
      fetchData(id)
    } else {
      setError("Invalid Google Sheets URL")
    }
  }

  const fetchData = async (id: string) => {
    setLoading(true)
    setError(null)
    try {
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${id}/values/${RANGE}?key=${API_KEY}`
      console.log("Fetching URL:", url)
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

      console.log("Total rows from sheet:", rows.length)
      setTotalSheetRows(rows.length)

      // Add original indices to rows before filtering
      const rowsWithIndices = rows.map((row: string[], index: number) => ({
        data: row,
        originalIndex: index + 2,
      }))

      // Filter out invalid entries while preserving original indices
      const validRows = rowsWithIndices.filter((row: RowData) => {
        const isValid = validateJobListing(row.data, headers)
        if (!isValid) {
          console.log(`Row ${row.originalIndex} failed validation:`, row.data)
        }
        return isValid
      })

      console.log("Valid rows after filtering:", validRows.length)
      console.log("Filtered out rows:", rows.length - validRows.length)

      if (validRows.length === 0) {
        throw new Error("No valid job listings found")
      }

      // Apply active filters
      const filteredRows = validRows.filter((row: { data: { [x: string]: string } }) => {
        return activeFilters.every((filter) => {
          if (filter.field === "both") {
            const titleIndex = headers.findIndex((header: string) => header.toLowerCase() === "title")
            const descIndex = headers.findIndex((header: string) => header.toLowerCase() === "description")

            const titleValue = row.data[titleIndex]?.toLowerCase() || ""
            const descValue = row.data[descIndex]?.toLowerCase() || ""
            const searchValue = filter.value.toLowerCase()

            if (filter.type === "include") {
              return titleValue.includes(searchValue) || descValue.includes(searchValue)
            } else {
              // For exclude, check if the search term appears as a word or part of a word
              const combinedText = `${titleValue} ${descValue}`
              const words = combinedText.split(/[\s,.-]+/).filter(Boolean)

              return !words.some(
                (word) =>
                  word === searchValue ||
                  word.includes(searchValue) ||
                  // Check for common word variations
                  word.startsWith(searchValue) ||
                  word.endsWith(searchValue) ||
                  // Handle plural forms and common suffixes
                  word.replace(/(?:ist|ists|ing|ed|er|ors|s)$/, "") === searchValue,
              )
            }
          } else {
            const fieldIndex = headers.findIndex((header: string) => header.toLowerCase() === filter.field.toLowerCase())
            if (fieldIndex === -1) return true

            const fieldValue = row.data[fieldIndex]?.toLowerCase() || ""
            const searchValue = filter.value.toLowerCase()

            if (filter.type === "include") {
              return fieldValue.includes(searchValue)
            } else {
              const words = fieldValue.split(/[\s,.-]+/).filter(Boolean)

              return !words.some(
                (word) =>
                  word === searchValue ||
                  word.includes(searchValue) ||
                  // Check for common word variations
                  word.startsWith(searchValue) ||
                  word.endsWith(searchValue) ||
                  // Handle plural forms and common suffixes
                  word.replace(/(?:ist|ists|ing|ed|er|ors|s)$/, "") === searchValue,
              )
            }
          }
        })
      })

      console.log("Filtered rows after applying active filters:", filteredRows.length)

      if (filteredRows.length === 0) {
        throw new Error("No valid job listings after applying filters")
      }

      // Store the data with original indices
      setData([headers, ...filteredRows.reverse().map((row: RowData) => row.data)])

      // Store the original indices separately
      const indices = filteredRows.map((row: RowData) => row.originalIndex)
      setRowIndices(indices.reverse())

      setCurrentIndex(1)
    } catch (error: unknown) {
      console.error("Error fetching data:", error)
      const errorMessage = error instanceof Error ? error.message : "Failed to fetch data"
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string | number | Date) => {
    if (!dateString) return ""
    try {
      const date = new Date(dateString)
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    } catch {
      return dateString
    }
  }

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    setStartX(e.touches[0].clientX)
    setIsDragging(true)
  }

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (startX === null) return
    const currentX = e.touches[0].clientX
    const diff = currentX - startX
    setOffsetX(diff)
  }

  const handleTouchEnd = () => {
    setIsDragging(false)
    if (Math.abs(offsetX) > 100) {
      if (offsetX > 0 && currentIndex > 1) {
        setCurrentIndex(currentIndex - 1)
      } else if (offsetX < 0 && currentIndex < data.length - 1) {
        setCurrentIndex(currentIndex + 1)
      }
    }
    setStartX(null)
    setOffsetX(0)
  }

  const handleSwipe = (direction: "left" | "right") => {
    const animationClass = direction === "left" ? "-translate-x-full" : "translate-x-full"
    if (cardRef.current) {
      cardRef.current.classList.add(animationClass)
      cardRef.current.classList.add("transition-transform")
      cardRef.current.classList.add("duration-300")

      setTimeout(() => {
        if (cardRef.current) {
          cardRef.current.classList.remove(animationClass)
          cardRef.current.classList.remove("transition-transform")
          cardRef.current.classList.remove("duration-300")

          if (direction === "left" && currentIndex < data.length - 1) {
            setCurrentIndex(currentIndex + 1)
          } else if (direction === "right" && currentIndex > 1) {
            setCurrentIndex(currentIndex - 1)
          }
        }
      }, 300)
    }
  }

  const deleteEntry = async (rowIndex: number) => {
    if (!spreadsheetId) return
    setIsDeleting(true)

    try {
      // Debug logging
      console.log("Delete operation debug:", {
        totalFilteredRows: data.length,
        totalSheetRows,
        attemptingToDeleteIndex: rowIndex,
        dataAtIndex: data[rowIndex],
        currentlyViewedJob: data[currentIndex],
      })

      // Calculate the actual row in the sheet
      // Add 1 for header row, and reverse the index because our display is reversed
      const actualRowIndex = totalSheetRows + 1 - rowIndex

      console.log("Calculated sheet position:", {
        actualRowIndex,
        formula: `(${totalSheetRows} + 1) - ${rowIndex}`,
        explanation: "totalSheetRows + 1 (header) - rowIndex (current position)",
      })

      const response = await fetch("/api/sheets/delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          spreadsheetId,
          rowIndex: actualRowIndex,
        }),
      })

      const responseData = await response.json()

      if (!response.ok) {
        throw new Error(responseData.error || "Failed to delete entry")
      }

      // Update the UI state
      const newData = [...data]
      newData.splice(rowIndex, 1)
      setData(newData)

      // Update total sheet rows
      setTotalSheetRows((prev) => prev - 1)

      if (currentIndex >= newData.length - 1) {
        setCurrentIndex(Math.max(1, newData.length - 2))
      }
    } catch (error: unknown) {
      console.error("Error deleting entry:", error)
      const errorMessage = error instanceof Error ? error.message : "Failed to delete entry"
      setError(errorMessage)
    } finally {
      setIsDeleting(false)
    }
  }

  const toggleJobApplied = (jobId: string) => {
    const newAppliedJobs = appliedJobs.includes(jobId)
      ? appliedJobs.filter((id) => id !== jobId)
      : [...appliedJobs, jobId]

    setAppliedJobs(newAppliedJobs)
    Cookies.set("appliedJobs", JSON.stringify(newAppliedJobs), { expires: 365 })
  }

  const toggleFilter = (field: string, value: string, type: "include" | "exclude") => {
    const filterExists = activeFilters.some(
      (filter) => filter.field === field && filter.value === value && filter.type === type,
    )

    const newFilters = filterExists
      ? activeFilters.filter((filter) => !(filter.field === field && filter.value === value && filter.type === type))
      : [...activeFilters, { field, value, type }]

    setActiveFilters(newFilters)
    Cookies.set("activeFilters", JSON.stringify(newFilters), { expires: 365 })

    // Reload data with new filters if we have a spreadsheet ID
    if (spreadsheetId) {
      fetchData(spreadsheetId)
    }
  }

  const FilterMenu = () => {
    const [filterField, setFilterField] = useState("")
    const [filterValue, setFilterValue] = useState("")
    const [filterType, setFilterType] = useState<"include" | "exclude">("exclude")
    const [isOpen, setIsOpen] = useState(false)

    const filterFields = [
      { value: "both", label: "Title & Description" },
      { value: "title", label: "Job Title" },
      { value: "description", label: "Job Description" },
    ]

    // Modified preset filters with combined title/description as first option
    const presetFilters = [
      { field: "both", value: "dental", type: "exclude", label: "Exclude Dental Jobs" },
      { field: "both", value: "IT", type: "exclude", label: "Exclude IT Jobs" },
      { field: "both", value: "engineer", type: "exclude", label: "Exclude Engineering Jobs" },
    ]

    const isFilterActive = (preset: (typeof presetFilters)[0]) => {
      if (preset.field === "both") {
        return activeFilters.some(
          (filter) =>
            (filter.field === "title" || filter.field === "description") &&
            filter.value === preset.value &&
            filter.type === preset.type,
        )
      }
      return activeFilters.some(
        (filter) => filter.field === preset.field && filter.value === preset.value && filter.type === preset.type,
      )
    }

    const handleFilterSubmit = () => {
      if (filterField && filterValue) {
        if (filterField === "both") {
          // Add both title and description filters
          toggleFilter("title", filterValue, filterType)
          toggleFilter("description", filterValue, filterType)
        } else {
          toggleFilter(filterField, filterValue, filterType)
        }
        setFilterField("")
        setFilterValue("")
      }
    }

    return (
      <div className="max-w-2xl mx-auto mb-6 bg-gray-800/50 backdrop-blur-sm rounded-xl p-4 border border-gray-700">
        <button onClick={() => setIsOpen(!isOpen)} className="w-full flex items-center justify-between text-white">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-blue-400" />
            <h3 className="text-lg font-semibold">Filter Jobs</h3>
            {activeFilters.length > 0 && (
              <span className={`text-white text-xs px-2 py-1 rounded-full ${
                activeFilters.some(f => f.type === 'include') ? 'bg-blue-500' : 'bg-red-500'
              }`}>
                {activeFilters.length}
              </span>
            )}
          </div>
          <span
            className="transform transition-transform duration-200"
            style={{
              display: "inline-block",
              transform: isOpen ? "rotate(90deg)" : "rotate(0deg)",
            }}
          >
            ▶
          </span>
        </button>

        {isOpen && (
          <div className="mt-4">
            {/* Active Filters */}
            <div className="flex flex-wrap gap-3 mb-4">
              {activeFilters.map((filter, index) => (
                <div
                  key={index}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm ${
                    filter.type === "include" ? "bg-blue-500/20 text-blue-300" : "bg-red-500/20 text-red-300"
                  } border border-gray-700`}
                >
                  <span>
                    {filterFields.find((f) => f.value === filter.field)?.label || filter.field}: {filter.value}
                  </span>
                  <button
                    onClick={() => toggleFilter(filter.field, filter.value, filter.type)}
                    className="hover:text-white"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>

            {/* Preset Filters */}
            <div className="mb-6">
              <h4 className="text-sm font-medium text-gray-400 mb-3">Quick Filters</h4>
              <div className="flex flex-wrap gap-2">
                {presetFilters.map((preset, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      if (preset.field === "both") {
                        toggleFilter("title", preset.value, preset.type as "include" | "exclude")
                        toggleFilter("description", preset.value, preset.type as "include" | "exclude")
                      } else {
                        toggleFilter(preset.field, preset.value, preset.type as "include" | "exclude")
                      }
                    }}
                    className={`px-3 py-1.5 rounded-full text-sm transition-colors duration-200 ${
                      isFilterActive(preset)
                        ? "bg-red-500 text-white"
                        : "bg-gray-700/50 text-gray-300 hover:bg-gray-700"
                    } border border-gray-600`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Filter Form */}
            <div className="flex flex-wrap gap-3">
              <select
                value={filterField}
                onChange={(e) => setFilterField(e.target.value)}
                className="bg-gray-900/50 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white"
              >
                <option value="">Select field to filter...</option>
                {filterFields.map((field) => (
                  <option key={field.value} value={field.value}>
                    {field.label}
                  </option>
                ))}
              </select>
              <input
                type="text"
                placeholder="Enter filter text..."
                value={filterValue}
                onChange={(e) => setFilterValue(e.target.value)}
                className="bg-gray-900/50 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white"
              />
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as "include" | "exclude")}
                className="bg-gray-900/50 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white"
              >
                <option value="exclude">Exclude</option>
                <option value="include">Include</option>
              </select>
              <button
                onClick={handleFilterSubmit}
                className={`px-4 py-1.5 rounded-lg text-sm text-white transition-colors ${
                  filterType === "include" ? "bg-blue-600 hover:bg-blue-700" : "bg-red-600 hover:bg-red-700"
                }`}
              >
                {filterType === "include" ? "Add Include Filter" : "Add Exclude Filter"}
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  if (!spreadsheetId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 p-6">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-5xl font-bold mb-8 text-center text-white">Google Sheet Viewer</h1>

          <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl shadow-lg p-8 border border-gray-700 mb-8">
            <div className="flex items-center gap-4 mb-6">
              <div className="bg-blue-500/10 p-3 rounded-full">
                <Globe className="w-4 h-4 sm:w-[18px] sm:h-[18px] text-blue-400" />
              </div>
              <h2 className="text-2xl font-semibold text-white">Welcome</h2>
            </div>

            <div className="space-y-6 text-gray-300">
              <p className="leading-relaxed">
                This app helps you organize and review job listings from various sources including Glassdoor,
                HiringCafe, USAJOBS.gov, PublicHealthJobs, and more. Simply connect your spreadsheet, and we'll
                transform it into an easy-to-navigate format.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
                <div className="flex items-start gap-3">
                  <div className="mt-1 text-blue-400">✓</div>
                  <p className="text-sm">Create custom filters and delete jobs you don't want to see</p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="mt-1 text-blue-400">✓</div>
                  <p className="text-sm">Track applications and take notes on important details all in one place</p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="mt-1 text-blue-400">✓</div>
                  <p className="text-sm">Easily manage and apply to job listings and see previously tracked jobs</p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="mt-1 text-blue-400">✓</div>
                  <p className="text-sm">Access your sheet from any device</p>
                </div>
              </div>
            </div>
          </div>

          <form
            onSubmit={handleUrlSubmit}
            className="bg-gray-800/50 backdrop-blur-sm rounded-2xl shadow-lg p-8 border border-gray-700"
          >
            <label className="block text-lg font-medium text-gray-200 mb-4">Enter Google Sheets URL</label>
            <input
              type="text"
              value={sheetUrl}
              onChange={(e) => setSheetUrl(e.target.value)}
              placeholder="https://docs.google.com/spreadsheets/d/..."
              className="w-full p-4 bg-gray-900/50 border border-gray-700 rounded-xl text-white mb-6 focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-500"
            />
            <button
              type="submit"
              className="w-full bg-blue-600 text-white py-4 px-6 rounded-xl hover:bg-blue-700 transition-colors duration-200 flex items-center justify-center gap-2"
            >
              <Globe className="w-4 h-4 sm:w-[18px] sm:h-[18px]" />
              Connect Sheet
            </button>
            {error && (
              <div className="mt-4 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
                <p className="text-red-400 text-center">{error}</p>
              </div>
            )}
          </form>

          {/* Show last used sheet if available */}
          {!sheetUrl && Cookies.get("lastSheetUrl") && (
            <div className="mt-6 text-center">
              <p className="text-gray-400 text-sm mb-2">Previously used sheet:</p>
              <button
                onClick={() => {
                  const savedUrl = Cookies.get("lastSheetUrl")
                  if (savedUrl) {
                    setSheetUrl(savedUrl)
                    const id = extractSpreadsheetId(savedUrl)
                    if (id) {
                      setSpreadsheetId(id)
                      fetchData(id)
                    }
                  }
                }}
                className="text-blue-400 hover:text-blue-300 text-sm underline"
              >
                Click to reconnect to last used sheet
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  if (loading)
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-900 to-gray-800">
        <div className="text-xl text-white">Loading jobs...</div>
      </div>
    )
  if (error)
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 p-4">
        <div className="max-w-md w-full bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700">
          <div className="text-xl text-red-400 mb-4">Error: {error}</div>

          {activeFilters.length > 0 && error.includes("No valid job listings after applying filters") && (
            <>
              <div className="text-gray-300 mb-4">Current filters might be too restrictive. You can:</div>

              <div className="flex flex-wrap gap-2 mb-4">
                {activeFilters.map((filter, index) => (
                  <div
                    key={index}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm ${
                      filter.type === "include" ? "bg-blue-500/20 text-blue-300" : "bg-red-500/20 text-red-300"
                    } border border-gray-700`}
                  >
                    <span>
                      {filter.field}: {filter.value}
                    </span>
                    <button
                      onClick={() => toggleFilter(filter.field, filter.value, filter.type)}
                      className="hover:text-white"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setActiveFilters([])
                    Cookies.set("activeFilters", "[]", { expires: 365 })
                    if (spreadsheetId) {
                      fetchData(spreadsheetId)
                    }
                  }}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 transition-colors"
                >
                  Clear All Filters
                </button>

                <button
                  onClick={() => {
                    setSpreadsheetId("")
                    setData([])
                    setSheetUrl("")
                    setActiveFilters([])
                    Cookies.set("activeFilters", "[]", { expires: 365 })
                  }}
                  className="bg-gray-700 text-white px-4 py-2 rounded-lg text-sm hover:bg-gray-600 transition-colors"
                >
                  Change Sheet
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    )

  const headers = data[0] || []
  const currentRow = data[currentIndex] || []
  const getFieldValue = (fieldName: string) => {
    const index = headers.findIndex((header) => header.toLowerCase() === fieldName.toLowerCase())
    return index !== -1 ? currentRow[index] : ""
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 p-2 sm:p-6">
      <div className="flex flex-col sm:flex-row items-center justify-between mb-4 sm:mb-6 max-w-2xl mx-auto">
        <div className="flex items-center gap-2 sm:gap-4 mb-4 sm:mb-0">
          <button
            onClick={() => handleSwipe("right")}
            className="p-2 sm:p-3 rounded-full bg-gray-800 text-white shadow-lg border border-gray-700 hover:bg-gray-700 transition-colors duration-200"
          >
            <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6 text-gray-400" />
          </button>

          <div className="text-xs sm:text-sm text-gray-300 bg-gray-800 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full border border-gray-700">
            Job {currentIndex} of {data.length - 1}
          </div>

          <button
            onClick={() => handleSwipe("left")}
            className="p-2 sm:p-3 rounded-full bg-gray-800 text-white shadow-lg border border-gray-700 hover:bg-gray-700 transition-colors duration-200"
          >
            <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6 text-gray-400" />
          </button>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={() => {
              setSpreadsheetId("")
              setData([])
              setSheetUrl("")
            }}
            className="text-sm text-gray-300 hover:text-white transition-colors duration-200"
          >
            Change Sheet
          </button>
        </div>
      </div>

      <FilterMenu />

      <div
        ref={cardRef}
        className={cn(
          "max-w-4xl mx-auto bg-gray-800 text-white rounded-2xl shadow-2xl overflow-hidden border border-gray-700",
          "transform transition-all duration-300 ease-out",
          isDragging ? "cursor-grabbing" : "cursor-grab",
          "hover:shadow-blue-900/20",
        )}
        style={{
          transform: `translateX(${offsetX}px)`,
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className="p-4 sm:p-8">
          <div className="flex flex-col sm:flex-row justify-between items-start mb-4 sm:mb-6">
            <div className="flex gap-3 sm:gap-4 w-full sm:w-auto">
              {getFieldValue("company_image") && (
                <img
                  src={getFieldValue("company_image") || "/placeholder.svg"}
                  alt={`${getFieldValue("company_name")} logo`}
                  className="w-12 h-12 sm:w-16 sm:h-16 object-contain rounded-lg bg-white p-2"
                  onError={(e) => {
                    ;(e.target as HTMLImageElement).style.display = "none"
                  }}
                />
              )}
              <div className="space-y-1 sm:space-y-2 flex-1">
                <h2 className="text-xl sm:text-3xl font-bold text-white">{getFieldValue("title")}</h2>
                <div className="flex items-center gap-2">
                  <Building className="w-4 h-4 sm:w-[18px] sm:h-[18px] text-blue-400" />
                  <span className="font-semibold text-base sm:text-lg text-blue-400">
                    {getFieldValue("company_name")}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex flex-col items-start sm:items-end gap-2 mt-2 sm:mt-0 w-full sm:w-auto">
              <div className="text-xs sm:text-sm text-gray-400">
                <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 inline mr-1" />
                Posted: {formatDate(getFieldValue("currentDate"))?.toString()}
              </div>
              {getFieldValue("company_website") && (
                <div className="text-xs sm:text-sm text-gray-400">
                  <Globe className="w-3.5 h-3.5 sm:w-4 sm:h-4 inline mr-1" />
                  Source: {new URL(getFieldValue("company_website")).hostname}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-6 mb-6 sm:mb-8">
            <div className="flex items-center gap-3">
              <MapPin className="w-4 h-4 sm:w-[18px] sm:h-[18px] text-gray-400 flex-shrink-0" />
              <span className="text-gray-200">{getFieldValue("location") || "Location not specified"}</span>
            </div>
            <div className="flex items-center gap-3">
              <Briefcase className="w-4 h-4 sm:w-[18px] sm:h-[18px] text-gray-400 flex-shrink-0" />
              <span className="text-gray-200">{getFieldValue("type") || "Type not specified"}</span>
            </div>
            <div className="flex items-center gap-3">
              <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 inline mr-1" />
              <span className="text-gray-200">
                {getFieldValue("experience")
                  ? `${getFieldValue("experience")}+ years experience`
                  : "Experience not specified"}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <DollarSign className="w-4 h-4 sm:w-[18px] sm:h-[18px] text-gray-400 flex-shrink-0" />
              <span className="text-gray-200">{getFieldValue("salary") || "Salary not specified"}</span>
            </div>
          </div>

          <div className="mb-8">
            <h3 className="text-xl font-semibold mb-3 text-blue-400">Description</h3>
            <div className="bg-gray-700/30 rounded-lg p-4">
              <p className="text-gray-300 whitespace-pre-wrap leading-relaxed">
                {getFieldValue("description") || "No description provided"}
              </p>
            </div>
          </div>

          {getFieldValue("skills") && (
            <div className="mb-8">
              <h3 className="text-xl font-semibold mb-3 text-blue-400">Skills</h3>
              <div className="flex flex-wrap gap-2">
                {getFieldValue("skills").split(",").map(
                  (skill: string | number | bigint | boolean | null | undefined, index: Key | null | undefined) => (
                    <span
                      key={index}
                      className="px-3 py-1 bg-gray-700 text-gray-200 rounded-full text-sm border border-gray-600 hover:border-blue-500 transition-colors duration-200"
                    >
                      {skill}
                    </span>
                  ),
                )}
              </div>
            </div>
          )}

          <div className="mb-8">
            <button
              onClick={() => setIsNotesOpen(!isNotesOpen)}
              className="flex items-center gap-2 text-xl font-semibold text-blue-400 hover:text-blue-300 transition-colors duration-200"
            >
              <span
                className="transform transition-transform duration-200"
                style={{
                  display: "inline-block",
                  transform: isNotesOpen ? "rotate(90deg)" : "rotate(0deg)",
                }}
              >
                ▶
              </span>
              Notes
              {getFieldValue("notes") && <span className="text-sm text-gray-400">(has notes)</span>}
            </button>

            {isNotesOpen && (
              <div className="mt-3 bg-gray-700/30 rounded-lg p-4">
                <textarea
                  value={getFieldValue("notes") || ""}
                  onChange={(e) => {
                    const noteColumnIndex = headers.findIndex((header) => header.toLowerCase() === "notes")
                    const newData = [...data]
                    newData[currentIndex][noteColumnIndex] = e.target.value
                    setData(newData)
                  }}
                  placeholder="Add your notes here..."
                  className="w-full min-h-[100px] bg-gray-800/50 border border-gray-600 rounded-lg p-3 text-gray-200 placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-3"
                />
                <button
                  onClick={async () => {
                    const noteValue = getFieldValue("notes")
                    const noteColumnIndex = headers.findIndex((header) => header.toLowerCase() === "notes")

                    if (noteColumnIndex === -1) {
                      setError("Notes column not found in sheet")
                      return
                    }

                    setLoading(true)
                    try {
                      const response = await fetch("/api/sheets/update-note", {
                        method: "POST",
                        headers: {
                          "Content-Type": "application/json",
                        },
                        body: JSON.stringify({
                          spreadsheetId,
                          rowIndex: data.length - currentIndex + 1,
                          note: noteValue,
                          noteColumnIndex,
                        }),
                      })

                      if (!response.ok) {
                        throw new Error("Failed to update note")
                      }
                    } catch (error) {
                      console.error("Error updating note:", error)
                      setError("Failed to save note")
                    } finally {
                      setLoading(false)
                    }
                  }}
                  disabled={loading}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <>
                      <span className="animate-spin">⏳</span>
                      Saving...
                    </>
                  ) : (
                    <>💾 Save Notes</>
                  )}
                </button>
              </div>
            )}
          </div>

          <div className="mt-6 sm:mt-8 flex flex-col sm:flex-row gap-3 sm:justify-between sm:items-center">
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                onClick={() => deleteEntry(currentIndex)}
                disabled={isDeleting}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
              >
                <Trash2 className="w-4 h-4 sm:w-[18px] sm:h-[18px]" />
                {isDeleting ? "Deleting..." : "Delete Job"}
              </button>

              <button
                onClick={() => toggleJobApplied(getFieldValue("id") || `${currentIndex}`)}
                className={`inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg transition-colors duration-200 text-sm sm:text-base ${
                  appliedJobs.includes(getFieldValue("id") || `${currentIndex}`)
                    ? "bg-green-600 hover:bg-green-700"
                    : "bg-gray-600 hover:bg-gray-700"
                } text-white`}
              >
                <CheckCircle className="w-4 h-4 sm:w-[18px] sm:h-[18px]" />
                {appliedJobs.includes(getFieldValue("id") || `${currentIndex}`) ? "Applied" : "Mark as Applied"}
              </button>
            </div>

            {getFieldValue("company_website") && (
              <a
                href={getFieldValue("company_website")}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 text-sm sm:text-base"
              >
                <Globe className="w-4 h-4 sm:w-[18px] sm:h-[18px]" />
                View Job Posting
              </a>
            )}
          </div>
        </div>
      </div>

      <div className="text-center mt-6 text-sm text-gray-400">Swipe or use buttons to navigate between jobs</div>
    </div>
  )
}

