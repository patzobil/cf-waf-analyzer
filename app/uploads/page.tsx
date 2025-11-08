"use client"

import { useState, useCallback, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { api } from '@/lib/api'
import { useDropzone } from 'react-dropzone'
import { Upload, File, CheckCircle, XCircle, AlertCircle, RefreshCw, Key } from 'lucide-react'

interface UploadResult {
  filename: string
  checksum?: string
  file_id?: number
  status: string
  total?: number
  inserted?: number
  deduped?: number
  error?: string
  errors?: string[]
  time_range?: {
    earliest: string
    latest: string
  }
  note?: string
  parse_errors?: number
}

export default function UploadsPage() {
  const [uploading, setUploading] = useState(false)
  const [uploadResults, setUploadResults] = useState<UploadResult[]>([])
  const [recentUploads, setRecentUploads] = useState<UploadResult[]>([])
  const [authToken, setAuthToken] = useState('')
  const [showTokenInput, setShowTokenInput] = useState(false)

  // Load token from localStorage on mount
  useEffect(() => {
    const token = localStorage.getItem('auth_token') || 
                  process.env.NEXT_PUBLIC_AUTH_TOKEN || 
                  'yourownauth' // Default dev token
    setAuthToken(token)
    if (!localStorage.getItem('auth_token')) {
      localStorage.setItem('auth_token', token)
    }
  }, [])

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return

    setUploading(true)
    try {
      const response = await api.uploadFiles(acceptedFiles)
      setUploadResults(response.results || [])
      // Add to recent uploads
      setRecentUploads(prev => [...response.results, ...prev].slice(0, 10))
    } catch (error) {
      console.error('Upload error:', error)
      setUploadResults([{
        filename: 'Upload failed',
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error'
      }])
    } finally {
      setUploading(false)
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/json': ['.json'],
      'text/plain': ['.ndjson', '.jsonl']
    },
    maxSize: 50 * 1024 * 1024, // 50MB
    multiple: true,
    disabled: uploading
  })

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-5 w-5 text-green-500" />
      case 'error':
        return <XCircle className="h-5 w-5 text-red-500" />
      case 'already_processed':
        return <AlertCircle className="h-5 w-5 text-yellow-500" />
      default:
        return <File className="h-5 w-5 text-gray-500" />
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return <Badge variant="success">Success</Badge>
      case 'error':
        return <Badge variant="destructive">Error</Badge>
      case 'already_processed':
        return <Badge variant="warning">Already Processed</Badge>
      case 'no_valid_events':
        return <Badge variant="secondary">No Valid Events</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const handleSaveToken = () => {
    localStorage.setItem('auth_token', authToken)
    setShowTokenInput(false)
  }

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">File Uploads</h2>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowTokenInput(!showTokenInput)}
        >
          <Key className="h-4 w-4 mr-2" />
          {showTokenInput ? 'Hide' : 'Configure'} Auth Token
        </Button>
      </div>

      {/* Auth Token Configuration */}
      {showTokenInput && (
        <Card>
          <CardHeader>
            <CardTitle>Authentication Token</CardTitle>
            <CardDescription>
              Set your API authentication token for file uploads
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input
                type="password"
                placeholder="Enter auth token"
                value={authToken}
                onChange={(e) => setAuthToken(e.target.value)}
                className="flex-1"
              />
              <Button onClick={handleSaveToken}>Save</Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Token is stored in browser localStorage. Default dev token is pre-filled.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Upload Area */}
      <Card>
        <CardHeader>
          <CardTitle>Upload WAF Export Files</CardTitle>
          <CardDescription>
            Drag and drop JSON or NDJSON files here, or click to browse
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            {...getRootProps()}
            className={cn(
              "border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors",
              isDragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50",
              uploading && "opacity-50 cursor-not-allowed"
            )}
          >
            <input {...getInputProps()} />
            {uploading ? (
              <div className="flex flex-col items-center gap-4">
                <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                <p className="text-lg font-medium">Processing files...</p>
                <p className="text-sm text-muted-foreground">This may take a few moments</p>
              </div>
            ) : isDragActive ? (
              <div className="flex flex-col items-center gap-4">
                <Upload className="h-12 w-12 text-primary" />
                <p className="text-lg font-medium">Drop the files here</p>
                <p className="text-sm text-muted-foreground">Release to upload</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4">
                <Upload className="h-12 w-12 text-muted-foreground" />
                <p className="text-lg font-medium">Drag & drop files here</p>
                <p className="text-sm text-muted-foreground">or click to browse</p>
                <p className="text-xs text-muted-foreground mt-2">
                  Supports JSON and NDJSON formats • Max 50MB per file
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Upload Results */}
      {uploadResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Upload Results</CardTitle>
            <CardDescription>
              Processing results for uploaded files
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {uploadResults.map((result, index) => (
                <div key={index} className="flex items-start gap-4 p-4 border rounded-lg">
                  {getStatusIcon(result.status)}
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="font-medium">{result.filename}</p>
                      {getStatusBadge(result.status)}
                    </div>
                    {result.status === 'success' && (
                      <div className="text-sm text-muted-foreground space-y-1">
                        <p>Total events: {result.total || 0}</p>
                        <p>Inserted: {result.inserted || 0}</p>
                        <p>Deduped: {result.deduped || 0}</p>
                        {result.file_id && <p>File ID: {result.file_id}</p>}
                        {result.time_range && (
                          <p className="text-xs">
                            Time range: {new Date(result.time_range.earliest).toLocaleString()} - {new Date(result.time_range.latest).toLocaleString()}
                          </p>
                        )}
                        {result.note && (
                          <p className="text-xs text-yellow-600 font-medium mt-2">
                            ⚠️ {result.note}
                          </p>
                        )}
                        {result.parse_errors !== undefined && result.parse_errors > 0 && (
                          <p className="text-xs text-yellow-600">
                            Parse errors: {result.parse_errors}
                          </p>
                        )}
                      </div>
                    )}
                    {result.error && (
                      <p className="text-sm text-destructive">{result.error}</p>
                    )}
                    {result.errors && result.errors.length > 0 && (
                      <div className="text-sm text-yellow-600">
                        <p className="font-medium">Parse errors:</p>
                        <ul className="list-disc list-inside">
                          {result.errors.slice(0, 3).map((err, i) => (
                            <li key={i}>{err}</li>
                          ))}
                          {result.errors.length > 3 && (
                            <li>... and {result.errors.length - 3} more</li>
                          )}
                        </ul>
                      </div>
                    )}
                  </div>
                  {result.status === 'success' && result.file_id && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        // Navigate to explore with file filter
                        window.location.href = `/explore?file_id=${result.file_id}`
                      }}
                    >
                      View Events
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Uploads */}
      {recentUploads.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Uploads</CardTitle>
            <CardDescription>
              Previously uploaded files in this session
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recentUploads.map((upload, index) => (
                <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(upload.status)}
                    <div>
                      <p className="text-sm font-medium">{upload.filename}</p>
                      <p className="text-xs text-muted-foreground">
                        {upload.total || 0} events • {upload.inserted || 0} inserted
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(upload.status)}
                    {upload.checksum && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={async () => {
                          try {
                            await api.reindex(upload.checksum)
                            // Refresh the upload
                            onDrop([])
                          } catch (error) {
                            console.error('Reindex error:', error)
                          }
                        }}
                      >
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ')
}
