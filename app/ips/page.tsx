"use client"

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DateRangePicker } from '@/components/layout/date-range-picker'
import { api } from '@/lib/api'
import { TopIP } from '@/lib/types'
import { Globe, MapPin, Activity, ChevronRight } from 'lucide-react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { format } from 'date-fns'

export default function IPsPage() {
  const [dateRange, setDateRange] = useState({
    start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    end: new Date(),
  })
  const [ips, setIPs] = useState<TopIP[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchTopIPs = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await api.getTopIPs(
        100,
        dateRange.start.getTime(),
        dateRange.end.getTime()
      )
      setIPs(data.ips || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch IPs')
    } finally {
      setLoading(false)
    }
  }, [dateRange])

  useEffect(() => {
    fetchTopIPs()
  }, [fetchTopIPs])

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
    return num.toString()
  }

  // Country distribution for pie chart
  const countryDistribution = ips.reduce((acc, ip) => {
    ip.countries?.forEach(country => {
      if (country) {
        acc[country] = (acc[country] || 0) + ip.count
      }
    })
    return acc
  }, {} as Record<string, number>)

  const pieData = Object.entries(countryDistribution)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([country, count]) => ({
      name: country,
      value: count
    }))

  const COLORS = [
    '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6',
    '#ec4899', '#06b6d4', '#f97316', '#84cc16', '#6366f1'
  ]

  const totalRequests = ips.reduce((sum, ip) => sum + ip.count, 0)
  const uniqueCountries = new Set(ips.flatMap(ip => ip.countries || [])).size
  const uniqueASNs = new Set(ips.flatMap(ip => ip.asns || [])).size

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">IP Analytics</h2>
        <DateRangePicker value={dateRange} onChange={setDateRange} />
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unique IPs</CardTitle>
            <Globe className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{ips.length}</div>
            <p className="text-xs text-muted-foreground">
              Distinct source IPs
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Requests</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(totalRequests)}</div>
            <p className="text-xs text-muted-foreground">
              From all IPs
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Countries</CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{uniqueCountries}</div>
            <p className="text-xs text-muted-foreground">
              Unique countries
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">ASNs</CardTitle>
            <Globe className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{uniqueASNs}</div>
            <p className="text-xs text-muted-foreground">
              Unique networks
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Country Distribution */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Country Distribution</CardTitle>
            <CardDescription>
              Top 10 countries by request count
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              </div>
            ) : pieData.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No data available</div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={(entry) => `${entry.name}: ${formatNumber(entry.value)}`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top Offenders</CardTitle>
            <CardDescription>
              IPs with the most requests
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              </div>
            ) : ips.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No data available</div>
            ) : (
              <div className="space-y-2">
                {ips.slice(0, 5).map((ip, index) => (
                  <div key={ip.src_ip} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium w-4">{index + 1}.</span>
                      <div>
                        <p className="font-mono text-sm font-medium">{ip.src_ip}</p>
                        <div className="flex gap-2 mt-1">
                          {ip.countries?.slice(0, 2).map(country => (
                            <Badge key={country} variant="outline" className="text-xs">
                              {country}
                            </Badge>
                          ))}
                          {ip.asns?.slice(0, 1).map(asn => (
                            <Badge key={asn} variant="secondary" className="text-xs">
                              AS{asn}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">{formatNumber(ip.count)}</p>
                      <p className="text-xs text-muted-foreground">requests</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* IPs Table */}
      <Card>
        <CardHeader>
          <CardTitle>All IPs</CardTitle>
          <CardDescription>
            Complete list of source IPs with details
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : error ? (
            <div className="text-center py-8 text-destructive">{error}</div>
          ) : ips.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No IPs found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2 font-medium">#</th>
                    <th className="text-left p-2 font-medium">IP Address</th>
                    <th className="text-left p-2 font-medium">Countries</th>
                    <th className="text-left p-2 font-medium">ASNs</th>
                    <th className="text-left p-2 font-medium">Requests</th>
                    <th className="text-left p-2 font-medium">Last Seen</th>
                    <th className="text-left p-2 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {ips.map((ip, index) => (
                    <tr key={ip.src_ip} className="border-b hover:bg-accent/50">
                      <td className="p-2 text-sm">{index + 1}</td>
                      <td className="p-2 font-mono text-sm">{ip.src_ip}</td>
                      <td className="p-2">
                        <div className="flex gap-1 flex-wrap">
                          {ip.countries?.map(country => (
                            <Badge key={country} variant="outline" className="text-xs">
                              {country}
                            </Badge>
                          ))}
                        </div>
                      </td>
                      <td className="p-2">
                        <div className="flex gap-1 flex-wrap">
                          {ip.asns?.map(asn => (
                            <Badge key={asn} variant="secondary" className="text-xs">
                              AS{asn}
                            </Badge>
                          ))}
                        </div>
                      </td>
                      <td className="p-2 font-bold">{formatNumber(ip.count)}</td>
                      <td className="p-2 text-sm">
                        {ip.last_seen ? format(new Date(ip.last_seen), 'MMM dd HH:mm') : '-'}
                      </td>
                      <td className="p-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            window.location.href = `/explore?src_ip=${ip.src_ip}`
                          }}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
