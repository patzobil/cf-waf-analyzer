"use client"

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DateRangePicker } from '@/components/layout/date-range-picker'
import { api } from '@/lib/api'
import { TopRule } from '@/lib/types'
import { Shield, TrendingUp, AlertTriangle, ChevronRight } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

export default function RulesPage() {
  const [dateRange, setDateRange] = useState({
    start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    end: new Date(),
  })
  const [rules, setRules] = useState<TopRule[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchTopRules = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await api.getTopRules(
        50,
        dateRange.start.getTime(),
        dateRange.end.getTime()
      )
      setRules(data.rules || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch rules')
    } finally {
      setLoading(false)
    }
  }, [dateRange])

  useEffect(() => {
    fetchTopRules()
  }, [fetchTopRules])

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
    return num.toString()
  }

  const getRuleTypeBadge = (type: string) => {
    switch (type) {
      case 'managed':
        return <Badge variant="default">Managed</Badge>
      case 'custom':
        return <Badge variant="secondary">Custom</Badge>
      default:
        return <Badge variant="outline">Unknown</Badge>
    }
  }

  const topRulesChartData = rules.slice(0, 10).map(rule => ({
    name: rule.rule_name || rule.rule_id,
    count: rule.count
  }))

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">WAF Rules</h2>
        <DateRangePicker value={dateRange} onChange={setDateRange} />
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Rules Triggered</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{rules.length}</div>
            <p className="text-xs text-muted-foreground">
              Unique rules in period
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Most Triggered</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold truncate">
              {rules[0]?.rule_name || rules[0]?.rule_id || 'N/A'}
            </div>
            <p className="text-xs text-muted-foreground">
              {rules[0] ? `${formatNumber(rules[0].count)} hits` : 'No data'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rule Types</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <span className="text-sm">
                Managed: {rules.filter(r => r.rule_type === 'managed').length}
              </span>
              <span className="text-sm">
                Custom: {rules.filter(r => r.rule_type === 'custom').length}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Rules Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Top 10 Rules</CardTitle>
          <CardDescription>
            Most frequently triggered rules in the selected period
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : error ? (
            <div className="text-center py-8 text-destructive">{error}</div>
          ) : topRulesChartData.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No data available</div>
          ) : (
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={topRulesChartData} layout="horizontal">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  width={200}
                  tick={{ fontSize: 12 }}
                />
                <Tooltip />
                <Bar dataKey="count" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Rules Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Rules</CardTitle>
          <CardDescription>
            Complete list of triggered rules with details
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : error ? (
            <div className="text-center py-8 text-destructive">{error}</div>
          ) : rules.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No rules found</div>
          ) : (
            <div className="space-y-2">
              {rules.map((rule, index) => (
                <div key={rule.rule_id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50">
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-medium w-8">{index + 1}.</span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">
                          {rule.rule_name || rule.rule_id}
                        </p>
                        {getRuleTypeBadge(rule.rule_type || 'unknown')}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Rule ID: {rule.rule_id}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="font-bold">{formatNumber(rule.count)}</p>
                      <p className="text-xs text-muted-foreground">hits</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        window.location.href = `/explore?rule_id=${rule.rule_id}`
                      }}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
