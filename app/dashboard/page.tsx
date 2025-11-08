"use client"

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { DateRangePicker } from '@/components/layout/date-range-picker'
import { api } from '@/lib/api'
import { Summary } from '@/lib/types'
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts'
import { Shield, Globe, AlertTriangle, Activity } from 'lucide-react'

const ACTION_COLORS = {
  block: '#ef4444',
  challenge: '#f59e0b',
  log: '#3b82f6',
  allow: '#10b981',
  skip: '#8b5cf6',
  unknown: '#6b7280',
}

export default function DashboardPage() {
  const [dateRange, setDateRange] = useState({
    start: new Date(Date.now() - 24 * 60 * 60 * 1000),
    end: new Date(),
  })
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchSummary = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await api.getSummary(
        dateRange.start.getTime(),
        dateRange.end.getTime()
      )
      setSummary(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch summary')
    } finally {
      setLoading(false)
    }
  }, [dateRange])

  useEffect(() => {
    fetchSummary()
  }, [fetchSummary])

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="mt-2 text-sm text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="mx-auto h-8 w-8 text-destructive" />
          <p className="mt-2 text-sm text-destructive">{error}</p>
        </div>
      </div>
    )
  }

  if (!summary) return null

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
    return num.toString()
  }

  const pieData = Object.entries(summary.actions_breakdown).map(([action, count]) => ({
    name: action,
    value: count,
  }))

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
        <DateRangePicker value={dateRange} onChange={setDateRange} />
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Events</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(summary.total_events)}</div>
            <p className="text-xs text-muted-foreground">
              Across all services
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Blocked Rate</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.blocked_percentage.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              Blocked & challenged
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unique IPs</CardTitle>
            <Globe className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(summary.unique_ips)}</div>
            <p className="text-xs text-muted-foreground">
              Distinct source IPs
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Top Rule Today</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold truncate">
              {summary.top_rule_today?.rule_name || summary.top_rule_today?.rule_id || 'N/A'}
            </div>
            <p className="text-xs text-muted-foreground">
              {summary.top_rule_today ? `${formatNumber(summary.top_rule_today.count)} hits` : 'No rules triggered'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Events Over Time</CardTitle>
            <CardDescription>
              Hourly breakdown of WAF events by action
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={350}>
              <AreaChart data={summary.time_series}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="timestamp" 
                  tickFormatter={(value) => new Date(value).toLocaleTimeString()}
                />
                <YAxis />
                <Tooltip 
                  labelFormatter={(value) => new Date(value).toLocaleString()}
                />
                <Legend />
                <Area type="monotone" dataKey="block" stackId="1" stroke={ACTION_COLORS.block} fill={ACTION_COLORS.block} />
                <Area type="monotone" dataKey="challenge" stackId="1" stroke={ACTION_COLORS.challenge} fill={ACTION_COLORS.challenge} />
                <Area type="monotone" dataKey="log" stackId="1" stroke={ACTION_COLORS.log} fill={ACTION_COLORS.log} />
                <Area type="monotone" dataKey="allow" stackId="1" stroke={ACTION_COLORS.allow} fill={ACTION_COLORS.allow} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Actions Distribution</CardTitle>
            <CardDescription>
              Breakdown by action type
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={350}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry) => `${entry.name}: ${entry.value}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={ACTION_COLORS[entry.name as keyof typeof ACTION_COLORS] || ACTION_COLORS.unknown} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Top Rules and Countries */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Top Rules</CardTitle>
            <CardDescription>
              Most frequently triggered rules
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {summary.top_rules.slice(0, 5).map((rule, index) => (
                <div key={rule.rule_id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{index + 1}.</span>
                    <div className="flex-1">
                      <p className="text-sm font-medium truncate">
                        {rule.rule_name || rule.rule_id}
                      </p>
                      <Badge variant="outline" className="text-xs">
                        {rule.rule_type}
                      </Badge>
                    </div>
                  </div>
                  <span className="text-sm font-bold">{formatNumber(rule.count)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top Countries</CardTitle>
            <CardDescription>
              Geographic distribution of requests
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart 
                data={Object.entries(summary.geo_distribution).slice(0, 10).map(([country, count]) => ({
                  country,
                  count,
                }))}
                layout="horizontal"
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="country" type="category" width={50} />
                <Tooltip />
                <Bar dataKey="count" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
