"use client"

import {
  useState,
  useRef,
  type Key,
} from "react"
import { ChevronLeft, ChevronRight, MapPin, Building, Clock, Globe, Briefcase, DollarSign, Trash2 } from "lucide-react"

const API_KEY = process.env.NEXT_PUBLIC_API_KEY;
const RANGE = process.env.NEXT_PUBLIC_RANGE;

const extractSpreadsheetId = (url: string) => {
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : null;
};

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

  const handleUrlSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const id = extractSpreadsheetId(sheetUrl)
    console.log("Extracted ID:", id)
    if (id) {
      setSpreadsheetId(id)
      fetchData(id)
    } else {
      setError("Invalid Google Sheets URL")
    }
  }

  const fetchData = async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${id}/values/${RANGE}?key=${API_KEY}`
      console.log("Fetching URL:", url)
      const response = await fetch(url);
  
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || "Failed to fetch data");
      }
  
      const result = await response.json();
      
      if (!result.values || result.values.length === 0) {
        throw new Error("No data found in sheet");
      }
  
      const headers = result.values[0];
      const rows = result.values.slice(1);
      setData([headers, ...rows.reverse()]);
      setCurrentIndex(1);
    } catch (error: unknown) {
      console.error("Error fetching data:", error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch data';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string | number | Date) => {
    if (!dateString) return "";
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return dateString;
    }
  };

  const parseJSON = (str: string) => {
    try {
      const parsed = JSON.parse(str);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    setStartX(e.touches[0].clientX)
  }

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (startX === null) return
    const currentX = e.touches[0].clientX
    const diff = currentX - startX
    setOffsetX(diff)
  }

  const handleTouchEnd = () => {
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

  const navigateCard = (direction: string) => {
    if (direction === "prev" && currentIndex > 1) {
      setCurrentIndex(currentIndex - 1)
    } else if (direction === "next" && currentIndex < data.length - 1) {
      setCurrentIndex(currentIndex + 1)
    }
  }

  const deleteEntry = async (rowIndex: number) => {
    if (!spreadsheetId) return;
    
    try {
      console.log('Attempting to delete row:', rowIndex);
      const response = await fetch('/api/sheets/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          spreadsheetId,
          rowIndex: data.length - rowIndex,
        }),
      });

      const responseData = await response.json();
      console.log('Delete response:', responseData);

      if (!response.ok) {
        throw new Error(responseData.error || 'Failed to delete entry');
      }

      const newData = [...data];
      newData.splice(rowIndex, 1);
      setData(newData);
      
      if (currentIndex >= newData.length - 1) {
        setCurrentIndex(Math.max(1, newData.length - 2));
      }
    } catch (error: unknown) {
      console.error('Error deleting entry:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete entry';
      setError(errorMessage);
    }
  };

  if (!spreadsheetId) {
    return (
      <div className="min-h-screen bg-gray-100 p-6">
        <div className="max-w-md mx-auto">
          <h1 className="text-3xl font-bold mb-6 text-center">Job Database Viewer</h1>
          <form onSubmit={handleUrlSubmit} className="bg-white rounded-xl shadow-lg p-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">Enter Google Sheets URL</label>
            <input
              type="text"
              value={sheetUrl}
              onChange={(e) => setSheetUrl(e.target.value)}
              placeholder="https://docs.google.com/spreadsheets/d/..."
              className="w-full p-2 border rounded-md mb-4"
            />
            <button type="submit" className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700">
              Load Sheet
            </button>
            {error && <div className="mt-4 text-red-600">{error}</div>}
          </form>
        </div>
      </div>
    )
  }

  if (loading)
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl">Loading...</div>
      </div>
    )
  if (error)
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl text-red-600">Error: {error}</div>
      </div>
    )

  const headers = data[0] || []
  const currentRow = data[currentIndex] || []
  const getFieldValue = (fieldName: string) => {
    const index = headers.findIndex((header) => header.toLowerCase() === fieldName.toLowerCase())
    return index !== -1 ? currentRow[index] : ""
  }

  return (
    <div className="min-h-screen bg-gray-900 p-6">
      <div className="flex items-center justify-between mb-6 max-w-2xl mx-auto">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigateCard("prev")}
            disabled={currentIndex <= 1}
            className="p-2 rounded-full bg-blue-600 text-white shadow-md disabled:opacity-50 hover:bg-blue-700 transition-colors"
          >
            <ChevronLeft size={24} />
          </button>

          <div className="text-sm text-gray-300 bg-gray-800 px-3 py-1 rounded-full">
            Job {currentIndex} of {data.length - 1}
          </div>

          <button
            onClick={() => navigateCard("next")}
            disabled={currentIndex >= data.length - 1}
            className="p-2 rounded-full bg-blue-600 text-white shadow-md disabled:opacity-50 hover:bg-blue-700 transition-colors"
          >
            <ChevronRight size={24} />
          </button>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={() => {
              if (window.confirm('Are you sure you want to delete this job entry?')) {
                deleteEntry(currentIndex);
              }
            }}
            className="p-2 rounded-full bg-red-600 text-white shadow-md hover:bg-red-700 transition-colors"
          >
            <Trash2 size={20} />
          </button>

          <button
            onClick={() => {
              setSpreadsheetId("")
              setData([])
              setSheetUrl("")
            }}
            className="text-sm text-gray-300 hover:text-white transition-colors"
          >
            Change Sheet
          </button>
        </div>
      </div>

      <div
        ref={cardRef}
        className="max-w-2xl mx-auto bg-black text-white rounded-xl shadow-lg overflow-hidden transform transition-transform"
        style={{
          transform: `translateX(${offsetX}px)`,
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className="p-8">
          <div className="flex justify-between items-center mb-6">
            <div className="text-sm text-gray-400">
              <Clock size={16} className="inline mr-1" />
              Posted: {formatDate(getFieldValue("currentDate"))?.toString()}
            </div>
          </div>

          <h2 className="text-3xl font-bold mb-3 text-blue-400">{getFieldValue("title")}</h2>
          <div className="flex items-center gap-2 mb-6">
            <Building size={18} className="text-gray-400" />
            <span className="font-semibold text-lg">{getFieldValue("company_name")}</span>
          </div>

          <div className="grid grid-cols-2 gap-6 mb-8">
            <div className="flex items-center gap-3">
              <MapPin size={18} className="text-gray-400" />
              <span className="text-gray-200">{getFieldValue("location")}</span>
            </div>
            <div className="flex items-center gap-3">
              <Briefcase size={18} className="text-gray-400" />
              <span className="text-gray-200">{getFieldValue("type")}</span>
            </div>
            <div className="flex items-center gap-3">
              <Clock size={18} className="text-gray-400" />
              <span className="text-gray-200">{getFieldValue("experience")}+ years experience</span>
            </div>
            {getFieldValue("salary") && (
              <div className="flex items-center gap-3">
                <DollarSign size={18} className="text-gray-400" />
                <span className="text-gray-200">{getFieldValue("salary")}</span>
              </div>
            )}
          </div>

          <div className="mb-8">
            <h3 className="text-xl font-semibold mb-3 text-blue-400">Description</h3>
            <p className="text-gray-300 whitespace-pre-wrap">{getFieldValue("description")}</p>
          </div>

          {getFieldValue("skills") && (
  <div className="mb-8">
    <h3 className="text-xl font-semibold mb-3 text-blue-400">Skills</h3>
    <div className="flex flex-wrap gap-2">
      {parseJSON(getFieldValue("skills")).map(
        (
          skill: string | number | bigint | boolean | null | undefined,
          index: Key | null | undefined,
        ) => (
          <span key={index} className="px-3 py-1 bg-blue-900 text-blue-200 rounded-full text-sm">
            {skill}
          </span>
        ),
      )}
    </div>
  </div>
)}

          {getFieldValue("company_website") && (
            <div className="mt-8">
              <a
                href={getFieldValue("company_website")}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-blue-400 hover:text-blue-300"
              >
                <Globe size={18} />
                View Job Posting
              </a>
            </div>
          )}
        </div>
      </div>

      <div className="text-center mt-6 text-sm text-gray-400">Swipe left or right to navigate between jobs</div>
    </div>
  )
}
