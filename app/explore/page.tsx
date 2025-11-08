"use client"

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge, type badgeVariants } from '@/components/ui/badge'
import type { VariantProps } from 'class-variance-authority'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DateRangePicker } from '@/components/layout/date-range-picker'
import { api } from '@/lib/api'
import { WAFEvent, EventsQuery } from '@/lib/types'
import { 
  ChevronLeft, 
  ChevronRight, 
  Search,
  Filter,
  Download,
  RefreshCw,
  ExternalLink
} from 'lucide-react'
import { format } from 'date-fns'

type BadgeVariant = VariantProps<typeof badgeVariants>['variant']

const ACTION_BADGE_VARIANTS: Record<string, BadgeVariant> = {
  block: 'destructive',
  challenge: 'warning',
  log: 'default',
  allow: 'success',
  skip: 'secondary',
  unknown: 'outline',
}

export default function ExplorePage() {
  const [dateRange, setDateRange] = useState({
    start: new Date(Date.now() - 24 * 60 * 60 * 1000),
    end: new Date(),
  })
  const [events, setEvents] = useState<WAFEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState<EventsQuery>({
    limit: 50,
    offset: 0,
  })
  const [total, setTotal] = useState(0)
  const [selectedEvent, setSelectedEvent] = useState<WAFEvent | null>(null)

  const fetchEvents = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await api.getEvents({
        ...filters,
        start_time: dateRange.start.getTime(),
        end_time: dateRange.end.getTime(),
        search: search || undefined,
      })
      setEvents(data.events || [])
      setTotal(data.total || 0)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch events')
    } finally {
      setLoading(false)
    }
  }, [dateRange, filters, search])

  useEffect(() => {
    fetchEvents()
  }, [fetchEvents])

  const handleSearch = () => {
    setFilters({ ...filters, offset: 0 })
    fetchEvents()
  }

  const handlePageChange = (newOffset: number) => {
    setFilters({ ...filters, offset: newOffset })
  }

  const currentPage = Math.floor((filters.offset || 0) / (filters.limit || 50)) + 1
  const totalPages = Math.ceil(total / (filters.limit || 50))

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">Explore Events</h2>
        <div className="flex items-center gap-2">
          <DateRangePicker value={dateRange} onChange={setDateRange} />
          <Button variant="outline" size="icon" onClick={fetchEvents}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon">
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Search & Filter</CardTitle>
          <CardDescription>
            Search through WAF events and apply filters
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <div className="flex-1">
              <Input
                placeholder="Search by path, user agent, or host..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
            </div>
            <Button onClick={handleSearch}>
              <Search className="h-4 w-4 mr-2" />
              Search
            </Button>
            <Button variant="outline">
              <Filter className="h-4 w-4 mr-2" />
              Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Events Table */}
      <Card>
        <CardHeader>
          <CardTitle>Events</CardTitle>
          <CardDescription>
            Showing {events.length} of {total} total events
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : error ? (
            <div className="text-center py-8 text-destructive">{error}</div>
          ) : events.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No events found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2 font-medium">Time</th>
                    <th className="text-left p-2 font-medium">Action</th>
                    <th className="text-left p-2 font-medium">Rule</th>
                    <th className="text-left p-2 font-medium">Host</th>
                    <th className="text-left p-2 font-medium">Path</th>
                    <th className="text-left p-2 font-medium">Method</th>
                    <th className="text-left p-2 font-medium">Status</th>
                    <th className="text-left p-2 font-medium">IP</th>
                    <th className="text-left p-2 font-medium">Country</th>
                    <th className="text-left p-2 font-medium">Ray ID</th>
                    <th className="text-left p-2 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((event) => (
                    <tr key={`${event.ray_id}-${event.event_ts}`} className="border-b hover:bg-accent/50">
                      <td className="p-2 text-sm">
                        {format(new Date(event.event_ts), 'MMM dd HH:mm:ss')}
                      </td>
                      <td className="p-2">
                        <Badge variant={ACTION_BADGE_VARIANTS[event.action || 'unknown'] || 'outline'}>
                          {event.action}
                        </Badge>
                      </td>
                      <td className="p-2 text-sm truncate max-w-[200px]" title={event.rule_name || event.rule_id || ''}>
                        {event.rule_name || event.rule_id || '-'}
                      </td>
                      <td className="p-2 text-sm truncate max-w-[150px]" title={event.host || ''}>
                        {event.host || '-'}
                      </td>
                      <td className="p-2 text-sm truncate max-w-[150px]" title={event.path || ''}>
                        {event.path || '-'}
                      </td>
                      <td className="p-2 text-sm">
                        {event.method || '-'}
                      </td>
                      <td className="p-2 text-sm">
                        {event.status || '-'}
                      </td>
                      <td className="p-2 text-sm font-mono">
                        {event.src_ip || '-'}
                      </td>
                      <td className="p-2 text-sm">
                        {event.src_country || '-'}
                      </td>
                      <td className="p-2 text-sm font-mono text-xs">
                        {event.ray_id.substring(0, 8)}...
                      </td>
                      <td className="p-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedEvent(event)}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-muted-foreground">
                Page {currentPage} of {totalPages}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(Math.max(0, (filters.offset || 0) - (filters.limit || 50)))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange((filters.offset || 0) + (filters.limit || 50))}
                  disabled={currentPage === totalPages}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Event Details Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={() => setSelectedEvent(null)}>
          <Card className="max-w-2xl w-full max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <CardHeader>
              <CardTitle>Event Details</CardTitle>
              <CardDescription>Ray ID: {selectedEvent.ray_id}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium">Time</p>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(selectedEvent.event_ts), 'PPpp')}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Action</p>
                    <Badge variant={ACTION_BADGE_VARIANTS[selectedEvent.action || 'unknown'] || 'outline'}>
                      {selectedEvent.action}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Rule</p>
                    <p className="text-sm text-muted-foreground">
                      {selectedEvent.rule_name || selectedEvent.rule_id || '-'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Service</p>
                    <p className="text-sm text-muted-foreground">
                      {selectedEvent.service || '-'}
                    </p>
                  </div>
                </div>
                
                <div>
                  <p className="text-sm font-medium mb-2">Request Details</p>
                  <div className="bg-muted p-3 rounded-md space-y-1">
                    <p className="text-sm"><strong>Host:</strong> {selectedEvent.host || '-'}</p>
                    <p className="text-sm"><strong>Path:</strong> {selectedEvent.path || '-'}</p>
                    <p className="text-sm"><strong>Method:</strong> {selectedEvent.method || '-'}</p>
                    <p className="text-sm"><strong>Status:</strong> {selectedEvent.status || '-'}</p>
                    <p className="text-sm"><strong>Bytes:</strong> {selectedEvent.bytes || '-'}</p>
                  </div>
                </div>

                <div>
                  <p className="text-sm font-medium mb-2">Client Details</p>
                  <div className="bg-muted p-3 rounded-md space-y-1">
                    <p className="text-sm"><strong>IP:</strong> {selectedEvent.src_ip || '-'}</p>
                    <p className="text-sm"><strong>Country:</strong> {selectedEvent.src_country || '-'}</p>
                    <p className="text-sm"><strong>ASN:</strong> {selectedEvent.src_asn || '-'}</p>
                    <p className="text-sm"><strong>Colo:</strong> {selectedEvent.colo || '-'}</p>
                    <p className="text-sm break-all"><strong>User Agent:</strong> {selectedEvent.ua || '-'}</p>
                    <p className="text-sm"><strong>JA3:</strong> {selectedEvent.ja3 || '-'}</p>
                  </div>
                </div>
              </div>
              <div className="mt-4 flex justify-end">
                <Button onClick={() => setSelectedEvent(null)}>Close</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
