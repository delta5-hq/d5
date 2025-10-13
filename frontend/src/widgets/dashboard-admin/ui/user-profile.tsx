import { useUserProfile, type FullUserStatistics, type UserWorkflowStatistics } from '@entities/admin'
import { useDialog } from '@entities/dialog'
import { ROLES } from '@shared/base-types'
import { Button } from '@shared/ui/button'
import { Card, CardContent } from '@shared/ui/card'
import { ConfirmationDialog } from '@shared/ui/confirmation-dialog'
import { Input } from '@shared/ui/input'
import { Label } from '@shared/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@shared/ui/table'
import React, { useEffect, useMemo, useState } from 'react'
import { FormattedMessage, useIntl } from 'react-intl'

interface UserProfileProps {
  userData: FullUserStatistics
  workflowsData: UserWorkflowStatistics[]
}

const convertDate = (dateString?: string) => {
  if (!dateString) return '-'
  const date = new Date(dateString)
  return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`
}

const SurveyContainer: React.FC<{ userData: FullUserStatistics }> = ({ userData }) => {
  const surveyData = Object.fromEntries(
    Object.entries(userData.meta?.store || {})
      .map(([k, v]) => {
        if (k === 'fieldsOfWork') {
          const values = Object.values(v as Record<string, string>).filter(Boolean)
          return [k, values.length ? values.join(', ') : null]
        }
        return [k, v]
      })
      .filter(([, v]) => v !== null),
  )

  if (!Object.keys(surveyData).length) return null

  return (
    <Card className="mb-4">
      <CardContent>
        <h3 className="text-gray-500 font-semibold mb-2">Survey Data</h3>
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        {Object.entries(surveyData).map(([key, value]: [string, any]) => (
          <p className="mb-1" key={key}>
            <b>{key}:</b> {value}
          </p>
        ))}
      </CardContent>
    </Card>
  )
}

const UserWorkflows: React.FC<{ userData: FullUserStatistics; rows: UserWorkflowStatistics[] }> = ({
  userData,
  rows,
}) => {
  if (!rows.length) return null

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Workflow (Id)</TableHead>
          <TableHead>Node Count</TableHead>
          <TableHead>Edge Count</TableHead>
          <TableHead>Shared With</TableHead>
          <TableHead>Free Nodes</TableHead>
          <TableHead>Created At</TableHead>
          <TableHead>Updated At</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map(row => (
          <TableRow key={row._id}>
            <TableCell>{row.workflowId}</TableCell>
            <TableCell>{row.nodeCount}</TableCell>
            <TableCell>{row.edgeCount}</TableCell>
            <TableCell>{row.sharedWithCount}</TableCell>
            <TableCell>{userData.limitNodes ? userData.limitNodes - row.nodeCount : '-'}</TableCell>
            <TableCell>{convertDate(row.createdAt)}</TableCell>
            <TableCell>{convertDate(row.updatedAt)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

const UserProfile: React.FC<UserProfileProps> = ({ userData, workflowsData }) => {
  const [comment, setComment] = useState('')
  const { formatMessage } = useIntl()
  const { deleteUser, updateComment } = useUserProfile(userData.id)
  const { showDialog } = useDialog()

  useEffect(() => {
    setComment(userData.comment || '')
  }, [userData.comment])

  const rows = useMemo(() => workflowsData, [workflowsData])

  const handleSaveComment = (txt: string) => {
    if (txt === userData.comment) return
    setComment(txt)
    updateComment({ data: txt })
  }

  return (
    <Card className="p-2 space-y-6">
      <Button onClick={() => window.history.back()} variant="default">
        {formatMessage({ id: 'back' })}
      </Button>

      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="bg-card p-3 space-y-2 rounded-xl">
            <p>
              <b>{formatMessage({ id: 'userProfileUserId' })}:</b> {userData.id}
            </p>
            <p>
              <b>{formatMessage({ id: 'userProfileName' })}:</b> {userData.name}
            </p>
            <p>
              <b>{formatMessage({ id: 'userProfileMail' })}:</b> {userData.mail}
            </p>
            <p>
              <b>{formatMessage({ id: 'userProfileWorkflowCount' })}:</b> {userData.workflowCount}
            </p>
            <p>
              <b>{formatMessage({ id: 'userProfileSharedWorkflows' })}:</b> {userData.shareCount}
            </p>
            <p>
              <b>{formatMessage({ id: 'userProfileNodeCount' })}:</b> {userData.nodeCount}
            </p>
            <p>
              <b>{formatMessage({ id: 'userProfileMaxNodeCount' })}:</b> {userData.biggestWorkflowCount}
            </p>
            <p>
              <b>{formatMessage({ id: 'userProfileNodeLimit' })}:</b> {userData.limitNodes ?? '-'}
            </p>
            <p>
              <b>{formatMessage({ id: 'userProfileSubscriber' })}:</b>{' '}
              {userData.roles?.includes(ROLES.subscriber) || userData.roles?.includes(ROLES.org_subscriber)
                ? '✓'
                : '✖'}
            </p>
            <p>
              <b>{formatMessage({ id: 'userProfileCreatedAt' })}:</b> {convertDate(userData.createdAt)}
            </p>
            <p>
              <b>{formatMessage({ id: 'userProfileLastWorkflowChange' })}:</b>{' '}
              {convertDate(userData.lastWorkflowChange)}
            </p>

            <Button
              onClick={() =>
                showDialog(ConfirmationDialog, {
                  question: `Delete user ${userData.name}?`,
                  headline: 'Confirm Delete',
                  onYes: () => deleteUser(),
                })
              }
              variant="danger"
            >
              {formatMessage({ id: 'userProfileDeleteUser' })}
            </Button>
          </div>

          <SurveyContainer userData={userData} />

          <Label htmlFor="comment">
            <FormattedMessage id="comment" />
          </Label>
          <Input
            id="comment"
            onBlur={() => handleSaveComment(comment)}
            onChange={e => setComment(e.target.value)}
            type="textarea"
            value={comment}
          />
        </div>

        <div className="col-span-1">
          <UserWorkflows rows={rows} userData={userData} />
        </div>
      </div>
    </Card>
  )
}

export default UserProfile
