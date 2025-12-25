import jwt from 'jsonwebtoken'
import {JWT_SECRET} from './shared/test-users.js'
import {ROLES, ACCESS_ROLES} from './shared/test-users.js'
import {
  publicRequest,
  subscriberRequest,
  administratorRequest,
  customerRequest,
  rawRequest,
} from './shared/requests'
import {testOrchestrator, testDataFactory} from './shared/test-data-factory'

describe('RBAC Security - Workflow Sharing and Access Control', () => {
  const subscriberUserId = 'subscriber'
  const customerUserId = 'customer'
  const administratorUserId = 'admin'

  /* Workflow factory helpers - DRY principle for test data creation */
  const createAdminWorkflow = (title = 'Admin Test Workflow') =>
    testDataFactory.createWorkflow({title, userId: administratorUserId})

  const createSubscriberWorkflow = (title = 'Subscriber Test Workflow') =>
    testDataFactory.createWorkflow({title, userId: subscriberUserId})

  const createCustomerWorkflow = (title = 'Customer Test Workflow') =>
    testDataFactory.createWorkflow({title, userId: customerUserId})

  const createPublicWorkflow = (title = 'Public Test Workflow', userId = administratorUserId) =>
    testDataFactory.createWorkflow({
      title,
      userId,
      share: {
        public: {enabled: true, hidden: false, writeable: false},
        access: [],
      },
    })

  const createPublicWriteableWorkflow = (title = 'Public Writeable Workflow') =>
    testDataFactory.createWorkflow({
      title,
      userId: administratorUserId,
      share: {
        public: {enabled: true, hidden: false, writeable: true},
        access: [],
      },
    })

  const createHiddenPublicWorkflow = (title = 'Hidden Public Workflow', userId = administratorUserId) =>
    testDataFactory.createWorkflow({
      title,
      userId,
      share: {
        public: {enabled: true, hidden: true, writeable: false},
        access: [],
      },
    })

  beforeAll(async () => {
    await testOrchestrator.prepareTestEnvironment()
  })

  afterAll(async () => {
    await testOrchestrator.cleanupTestEnvironment()
  })

  describe('Owner-Only Operations - Share Configuration', () => {
    it('prevents non-owner from updating public sharing', async () => {
      const adminWorkflow = await createAdminWorkflow('Non-owner public sharing test')

      const response = await subscriberRequest.post(`/workflow/${adminWorkflow.workflowId}/share/public`).send({
        enabled: true,
        hidden: false,
      })

      expect(response.status).toBe(403)
      expect(response.body.message).toMatch(/owner/i)
    })

    it('prevents non-owner from updating access list', async () => {
      const adminWorkflow = await createAdminWorkflow('Non-owner access list test')

      const response = await subscriberRequest.post(`/workflow/${adminWorkflow.workflowId}/share/access`).send([
        {
          subjectId: subscriberUserId,
          subjectType: 'user',
          role: ACCESS_ROLES.reader,
        },
      ])

      expect(response.status).toBe(403)
      expect(response.body.message).toMatch(/owner/i)
    })

    it('prevents contributor from updating public sharing', async () => {
      const testWorkflow = await testDataFactory.createWorkflow({title: 'Contributor Test'})
      
      await administratorRequest.post(`/workflow/${testWorkflow.workflowId}/share/access`).send([
        {
          subjectId: subscriberUserId,
          subjectType: 'user',
          role: ACCESS_ROLES.contributor,
        },
      ])

      const response = await subscriberRequest.post(`/workflow/${testWorkflow.workflowId}/share/public`).send({
        enabled: true,
      })

      expect(response.status).toBe(403)
    })

    it('prevents reader from updating public sharing', async () => {
      const testWorkflow = await testDataFactory.createWorkflow({title: 'Reader Test'})
      
      await administratorRequest.post(`/workflow/${testWorkflow.workflowId}/share/access`).send([
        {
          subjectId: subscriberUserId,
          subjectType: 'user',
          role: ACCESS_ROLES.reader,
        },
      ])

      const response = await subscriberRequest.post(`/workflow/${testWorkflow.workflowId}/share/public`).send({
        enabled: true,
      })

      expect(response.status).toBe(403)
    })

    it('allows owner role in access list to update sharing', async () => {
      /* Create dedicated workflow to avoid polluting subscriberWorkflowId */
      const testWorkflow = await testDataFactory.createWorkflow({
        title: 'Owner Role Test Workflow',
        userId: subscriberUserId,
      })

      await administratorRequest.post(`/workflow/${testWorkflow.workflowId}/share/access`).send([
        {
          subjectId: customerUserId,
          subjectType: 'user',
          role: ACCESS_ROLES.owner,
        },
      ])

      const response = await customerRequest.post(`/workflow/${testWorkflow.workflowId}/share/public`).send({
        enabled: true,
        hidden: true,
      })

      expect(response.status).toBe(200)
    })

    it('prevents non-administrator from enabling public writeable workflow', async () => {
      const subscriberWorkflow = await createSubscriberWorkflow('Non-admin writeable test')

      const response = await subscriberRequest.post(`/workflow/${subscriberWorkflow.workflowId}/share/public`).send({
        enabled: true,
        hidden: false,
        writeable: true,
      })

      expect(response.status).toBe(403)
      expect(response.body.message).toMatch(/administrator/i)
    })
  })

  describe('Access Role Privilege Escalation', () => {
    it('prevents reader from deleting workflow', async () => {
      const testWorkflow = await testDataFactory.createWorkflow({
        title: 'Delete Test',
        share: {
          access: [
            {
              subjectId: subscriberUserId,
              subjectType: 'user',
              role: ACCESS_ROLES.reader,
            },
          ],
        },
      })

      const response = await subscriberRequest.delete(`/workflow/${testWorkflow.workflowId}`)

      expect(response.status).toBe(403)
    })

    it('prevents contributor from deleting workflow', async () => {
      const testWorkflow = await testDataFactory.createWorkflow({
        title: 'Delete Test 2',
        share: {
          access: [
            {
              subjectId: subscriberUserId,
              subjectType: 'user',
              role: ACCESS_ROLES.contributor,
            },
          ],
        },
      })

      const response = await subscriberRequest.delete(`/workflow/${testWorkflow.workflowId}`)

      expect(response.status).toBe(403)
    })

    it('prevents reader from updating workflow', async () => {
      const testWorkflow = await testDataFactory.createWorkflow({
        title: 'Update Test',
        share: {
          access: [
            {
              subjectId: subscriberUserId,
              subjectType: 'user',
              role: ACCESS_ROLES.reader,
            },
          ],
        },
      })

      const response = await subscriberRequest.post(`/workflow/${testWorkflow.workflowId}/category`).send({
        category: 'private',
      })

      expect(response.status).toBe(403)
    })

    it('allows contributor to update workflow', async () => {
      const testWorkflow = await testDataFactory.createWorkflow({
        title: 'Contributor Update Test',
        share: {
          access: [
            {
              subjectId: subscriberUserId,
              subjectType: 'user',
              role: ACCESS_ROLES.contributor,
            },
          ],
        },
      })

      const response = await subscriberRequest.post(`/workflow/${testWorkflow.workflowId}/category`).send({
        category: 'private',
      })

      expect(response.status).toBe(200)
    })

    it('prevents reader from granting themselves owner role', async () => {
      const testWorkflow = await testDataFactory.createWorkflow({
        title: 'Privilege Escalation Test',
        share: {
          access: [
            {
              subjectId: subscriberUserId,
              subjectType: 'user',
              role: ACCESS_ROLES.reader,
            },
          ],
        },
      })

      const response = await subscriberRequest.post(`/workflow/${testWorkflow.workflowId}/share/access`).send([
        {
          subjectId: subscriberUserId,
          subjectType: 'user',
          role: ACCESS_ROLES.owner,
        },
      ])

      expect(response.status).toBe(403)
    })

    it('prevents contributor from granting themselves owner role', async () => {
      const testWorkflow = await testDataFactory.createWorkflow({
        title: 'Contributor Escalation Test',
        share: {
          access: [
            {
              subjectId: subscriberUserId,
              subjectType: 'user',
              role: ACCESS_ROLES.contributor,
            },
          ],
        },
      })

      const response = await subscriberRequest.post(`/workflow/${testWorkflow.workflowId}/share/access`).send([
        {
          subjectId: subscriberUserId,
          subjectType: 'user',
          role: ACCESS_ROLES.owner,
        },
      ])

      expect(response.status).toBe(403)
    })
  })

  describe('Subject Type Spoofing and ID Manipulation', () => {
    it('prevents accessing workflow by spoofing mail subject type', async () => {
      const token = jwt.sign(
        {
          sub: 'attacker_user',
          roles: [ROLES.subscriber],
        },
        JWT_SECRET,
        {expiresIn: 86400},
      )

      const testWorkflow = await testDataFactory.createWorkflow({
        title: 'Mail Spoofing Test',
        share: {
          access: [
            {
              subjectId: 'admin@example.com',
              subjectType: 'mail',
              role: ACCESS_ROLES.owner,
            },
          ],
        },
      })

      const response = await rawRequest
        .get(`/api/v1/workflow/${testWorkflow.workflowId}`)
        .set('Authorization', `Bearer ${token}`)

      expect(response.status).toBe(401)
    })

    it('prevents accessing workflow by spoofing group subject type', async () => {
      const token = jwt.sign(
        {
          sub: 'attacker_user',
          roles: [ROLES.subscriber],
        },
        JWT_SECRET,
        {expiresIn: 86400},
      )

      const testWorkflow = await testDataFactory.createWorkflow({
        title: 'Group Spoofing Test',
        share: {
          access: [
            {
              subjectId: 'admin_group',
              subjectType: 'group',
              role: ACCESS_ROLES.owner,
            },
          ],
        },
      })

      const response = await rawRequest
        .get(`/api/v1/workflow/${testWorkflow.workflowId}`)
        .set('Authorization', `Bearer ${token}`)

      expect(response.status).toBe(401)
    })

    it('prevents adding access rule with invalid subject type', async () => {
      const adminWorkflow = await createAdminWorkflow('Invalid subject type test')

      const response = await administratorRequest.post(`/workflow/${adminWorkflow.workflowId}/share/access`).send([
        {
          subjectId: subscriberUserId,
          subjectType: 'invalid_type',
          role: ACCESS_ROLES.reader,
        },
      ])

      expect(response.status).toBe(400)
    })

    it('prevents adding access rule with empty subject ID', async () => {
      const adminWorkflow = await createAdminWorkflow('Empty subject ID test')

      const response = await administratorRequest.post(`/workflow/${adminWorkflow.workflowId}/share/access`).send([
        {
          subjectId: '',
          subjectType: 'user',
          role: ACCESS_ROLES.reader,
        },
      ])

      expect(response.status).toBe(400)
    })

    it('prevents adding access rule with null subject ID', async () => {
      const adminWorkflow = await createAdminWorkflow('Null subject ID test')

      const response = await administratorRequest.post(`/workflow/${adminWorkflow.workflowId}/share/access`).send([
        {
          subjectId: null,
          subjectType: 'user',
          role: ACCESS_ROLES.reader,
        },
      ])

      expect(response.status).toBe(400)
    })

    it('prevents adding access rule with SQL injection in subject ID', async () => {
      const adminWorkflow = await createAdminWorkflow('SQL injection test')

      const response = await administratorRequest.post(`/workflow/${adminWorkflow.workflowId}/share/access`).send([
        {
          subjectId: "admin' OR '1'='1",
          subjectType: 'user',
          role: ACCESS_ROLES.reader,
        },
      ])

      expect(response.status).toBe(400)
    })

    it('prevents adding access rule with XSS in subject ID', async () => {
      const adminWorkflow = await createAdminWorkflow('XSS test')

      const response = await administratorRequest.post(`/workflow/${adminWorkflow.workflowId}/share/access`).send([
        {
          subjectId: '<script>alert("xss")</script>',
          subjectType: 'user',
          role: ACCESS_ROLES.reader,
        },
      ])

      expect(response.status).toBe(400)
    })
  })

  describe('Public Workflow Access Control', () => {
    it('allows unauthenticated read access to public workflow', async () => {
      const publicWorkflow = await createPublicWorkflow('Unauthenticated read test')

      const response = await publicRequest.get(`/workflow/${publicWorkflow.workflowId}`)

      expect(response.status).toBe(200)
    })

    it('prevents unauthenticated write access to public non-writeable workflow', async () => {
      const publicWorkflow = await createPublicWorkflow('Unauthenticated write test')

      const response = await publicRequest.post(`/workflow/${publicWorkflow.workflowId}/category`).send({
        category: 'test',
      })

      expect(response.status).toBe(401)
    })

    it('allows authenticated write access to public writeable workflow', async () => {
      const publicWriteableWorkflow = await createPublicWriteableWorkflow('Authenticated write test')

      const response = await subscriberRequest.post(`/workflow/${publicWriteableWorkflow.workflowId}/category`).send({
        category: 'test',
      })

      expect(response.status).toBe(200)
    })

    it('prevents unauthenticated delete of public workflow', async () => {
      const publicWorkflow = await createPublicWorkflow('Unauthenticated delete test')

      const response = await publicRequest.delete(`/workflow/${publicWorkflow.workflowId}`)

      expect(response.status).toBe(401)
    })

    it('prevents non-owner from deleting public workflow', async () => {
      const publicWorkflow = await createPublicWorkflow('Non-owner delete test')

      const response = await subscriberRequest.delete(`/workflow/${publicWorkflow.workflowId}`)

      expect(response.status).toBe(403)
    })

    it('prevents listing hidden public workflows', async () => {
      const hiddenWorkflow = await createHiddenPublicWorkflow('Hidden public workflow listing test')

      const response = await publicRequest.get('/workflow?public=true')

      expect(response.status).toBe(200)
      const workflows = JSON.parse(response.text)
      expect(workflows.data.some(w => w.workflowId === hiddenWorkflow.workflowId)).toBe(false)
    })

    it('allows owner to access hidden public workflow', async () => {
      const hiddenWorkflow = await createHiddenPublicWorkflow('Owner access hidden test', subscriberUserId)

      const response = await subscriberRequest.get(`/workflow/${hiddenWorkflow.workflowId}`)

      expect(response.status).toBe(200)
    })
  })

  describe('Role Hierarchy and Permission Boundaries', () => {
    it('prevents subscriber from accessing administrator-only endpoints', async () => {
      const response = await subscriberRequest.get('/user')

      expect(response.status).toBe(403)
    })

    it('prevents customer from accessing administrator-only endpoints', async () => {
      const response = await customerRequest.get('/user')

      expect(response.status).toBe(403)
    })

    it('allows administrator to access all workflows', async () => {
      const subscriberWorkflow = await createSubscriberWorkflow('Admin access subscriber workflow')
      const customerWorkflow = await createCustomerWorkflow('Admin access customer workflow')

      const response1 = await administratorRequest.get(`/workflow/${subscriberWorkflow.workflowId}`)
      const response2 = await administratorRequest.get(`/workflow/${customerWorkflow.workflowId}`)

      expect(response1.status).toBe(200)
      expect(response2.status).toBe(200)
    })

    it('prevents subscriber from creating org_subscriber workflows', async () => {
      const token = jwt.sign(
        {
          sub: subscriberUserId,
          roles: [ROLES.org_subscriber],
        },
        JWT_SECRET,
        {expiresIn: 86400},
      )

      const response = await rawRequest
        .post('/api/v1/workflow')
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: 'Org Subscriber Test',
        })

      expect(response.status).toBe(401)
    })
  })

  describe('Concurrent Access and Race Conditions', () => {
    it('handles concurrent access list updates without corruption', async () => {
      const testWorkflow = await testDataFactory.createWorkflow({
        title: 'Concurrent Access Test',
      })

      const updates = [
        administratorRequest.post(`/workflow/${testWorkflow.workflowId}/share/access`).send([
          {
            subjectId: subscriberUserId,
            subjectType: 'user',
            role: ACCESS_ROLES.reader,
          },
        ]),
        administratorRequest.post(`/workflow/${testWorkflow.workflowId}/share/access`).send([
          {
            subjectId: customerUserId,
            subjectType: 'user',
            role: ACCESS_ROLES.contributor,
          },
        ]),
      ]

      const results = await Promise.all(updates)

      expect(results.every(r => r.status === 200)).toBe(true)

      const finalAccess = await administratorRequest.get(`/workflow/${testWorkflow.workflowId}/share/access`)
      expect(finalAccess.status).toBe(200)
      expect(Array.isArray(finalAccess.body)).toBe(true)
    })

    it('handles concurrent public sharing updates', async () => {
      const testWorkflow = await testDataFactory.createWorkflow({
        title: 'Concurrent Public Test',
      })

      const updates = [
        administratorRequest.post(`/workflow/${testWorkflow.workflowId}/share/public`).send({
          enabled: true,
          hidden: false,
        }),
        administratorRequest.post(`/workflow/${testWorkflow.workflowId}/share/public`).send({
          enabled: true,
          hidden: true,
        }),
      ]

      const results = await Promise.all(updates)

      expect(results.every(r => r.status === 200)).toBe(true)
    })
  })

  describe('Access List Boundary Conditions', () => {
    it('handles empty access list', async () => {
      const adminWorkflow = await createAdminWorkflow('Empty access list test')

      const response = await administratorRequest.post(`/workflow/${adminWorkflow.workflowId}/share/access`).send([])

      expect(response.status).toBe(200)
    })

    it('prevents access list with only invalid entries', async () => {
      const adminWorkflow = await createAdminWorkflow('Invalid entries test')

      const response = await administratorRequest.post(`/workflow/${adminWorkflow.workflowId}/share/access`).send([
        {subjectId: '', subjectType: 'user', role: ACCESS_ROLES.reader},
        {subjectId: null, subjectType: 'user', role: ACCESS_ROLES.reader},
      ])

      expect(response.status).toBe(400)
    })

    it('handles large access list', async () => {
      const adminWorkflow = await createAdminWorkflow('Large access list test')

      const largeAccessList = Array.from({length: 100}, (_, i) => ({
        subjectId: `user_${i}@example.com`,
        subjectType: 'mail',
        role: ACCESS_ROLES.reader,
      }))

      const response = await administratorRequest.post(`/workflow/${adminWorkflow.workflowId}/share/access`).send(largeAccessList)

      expect(response.status).toBe(200)
    })

    it('handles duplicate entries in access list', async () => {
      const adminWorkflow = await createAdminWorkflow('Duplicate entries test')

      const response = await administratorRequest.post(`/workflow/${adminWorkflow.workflowId}/share/access`).send([
        {
          subjectId: subscriberUserId,
          subjectType: 'user',
          role: ACCESS_ROLES.reader,
        },
        {
          subjectId: subscriberUserId,
          subjectType: 'user',
          role: ACCESS_ROLES.contributor,
        },
      ])

      expect(response.status).toBe(200)

      const accessList = await administratorRequest.get(`/workflow/${adminWorkflow.workflowId}/share/access`)
      const userEntries = accessList.body.filter(a => a.subjectId === subscriberUserId)
      expect(userEntries.length).toBeLessThanOrEqual(2)
    })

    it('rejects access list as non-array', async () => {
      const adminWorkflow = await createAdminWorkflow('Non-array access list test')

      const response = await administratorRequest.post(`/workflow/${adminWorkflow.workflowId}/share/access`).send({
        subjectId: subscriberUserId,
        subjectType: 'user',
        role: ACCESS_ROLES.reader,
      })

      expect(response.status).toBe(400)
    })

    it('rejects access list as string', async () => {
      const adminWorkflow = await createAdminWorkflow('String access list test')

      const response = await administratorRequest.post(`/workflow/${adminWorkflow.workflowId}/share/access`).send('reader')

      expect(response.status).toBe(400)
    })
  })

  describe('Cross-User Workflow Leakage', () => {
    it('prevents subscriber from accessing another subscriber workflow', async () => {
      const customerWorkflow = await createCustomerWorkflow('Cross-user access test')

      const response = await subscriberRequest.get(`/workflow/${customerWorkflow.workflowId}`)

      expect(response.status).toBe(401)
    })

    it('prevents customer from accessing subscriber workflow', async () => {
      const subscriberWorkflow = await createSubscriberWorkflow('Reverse cross-user access test')

      const response = await customerRequest.get(`/workflow/${subscriberWorkflow.workflowId}`)

      expect(response.status).toBe(401)
    })

    it('prevents listing workflows of other users', async () => {
      const customerWorkflow = await createCustomerWorkflow('Listing leak test')

      const response = await subscriberRequest.get('/workflow?public=false')

      expect(response.status).toBe(200)
      const workflows = JSON.parse(response.text)
      
      /* Subscriber should only see: their own workflows + workflows they have access to */
      /* customerWorkflow should NOT appear (no access granted) */
      const hasCustomerWorkflow = workflows.data.some(w => w.workflowId === customerWorkflow.workflowId)
      expect(hasCustomerWorkflow).toBe(false)
    })

    it('prevents workflow ID enumeration attack', async () => {
      const randomWorkflowIds = [
        'nonexistent123',
        '../../../etc/passwd',
        '../../admin/workflow',
        'workflow_${subscriberWorkflowId}',
      ]

      for (const fakeId of randomWorkflowIds) {
        const response = await subscriberRequest.get(`/workflow/${fakeId}`)
        expect([401, 404]).toContain(response.status)
      }
    })
  })

  describe('Public Sharing Permission Edge Cases', () => {
    it('rejects public sharing update without enabled field', async () => {
      const adminWorkflow = await createAdminWorkflow('Missing enabled field test')

      const response = await administratorRequest.post(`/workflow/${adminWorkflow.workflowId}/share/public`).send({
        hidden: false,
        writeable: false,
      })

      expect(response.status).toBe(400)
    })

    it('allows partial public sharing update', async () => {
      const adminWorkflow = await createAdminWorkflow('Partial update test')

      await administratorRequest.post(`/workflow/${adminWorkflow.workflowId}/share/public`).send({
        enabled: true,
        hidden: false,
      })

      const response = await administratorRequest.post(`/workflow/${adminWorkflow.workflowId}/share/public`).send({
        enabled: true,
        writeable: false,
      })

      expect(response.status).toBe(200)
    })

    it('prevents enabling public writeable without administrator role', async () => {
      const subscriberWorkflow = await createSubscriberWorkflow('Non-admin writeable edge test')

      const token = jwt.sign(
        {
          sub: subscriberUserId,
          roles: [ROLES.subscriber],
        },
        JWT_SECRET,
        {expiresIn: 86400},
      )

      const response = await rawRequest
        .post(`/api/v1/workflow/${subscriberWorkflow.workflowId}/share/public`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          enabled: true,
          hidden: false,
          writeable: true,
        })

      expect(response.status).toBe(403)
    })

    it('prevents enabling public writeable non-hidden without administrator role', async () => {
      const subscriberWorkflow = await createSubscriberWorkflow('Non-admin public writeable test')

      const response = await subscriberRequest.post(`/workflow/${subscriberWorkflow.workflowId}/share/public`).send({
        enabled: true,
        hidden: false,
        writeable: true,
      })

      expect(response.status).toBe(403)
    })

    it('allows administrator to enable public writeable', async () => {
      const adminWorkflow = await createAdminWorkflow('Admin public writeable test')

      const response = await administratorRequest.post(`/workflow/${adminWorkflow.workflowId}/share/public`).send({
        enabled: true,
        hidden: false,
        writeable: true,
      })

      expect(response.status).toBe(200)
    })
  })

  describe('Mail-Based Access Control', () => {
    it('grants access via mail subject type when JWT contains mail claim', async () => {
      const testMail = 'test-mail@example.com'
      const token = jwt.sign(
        {
          sub: 'external_user',
          mail: testMail,
          roles: [ROLES.subscriber],
        },
        JWT_SECRET,
        {expiresIn: 86400},
      )

      const testWorkflow = await testDataFactory.createWorkflow({
        title: 'Mail Access Test',
        share: {
          access: [
            {
              subjectId: testMail,
              subjectType: 'mail',
              role: ACCESS_ROLES.reader,
            },
          ],
        },
      })

      const response = await rawRequest
        .get(`/api/v1/workflow/${testWorkflow.workflowId}`)
        .set('Authorization', `Bearer ${token}`)

      expect(response.status).toBe(200)
    })

    it('prevents access with mismatched mail claim', async () => {
      const token = jwt.sign(
        {
          sub: 'external_user',
          mail: 'wrong@example.com',
          roles: [ROLES.subscriber],
        },
        JWT_SECRET,
        {expiresIn: 86400},
      )

      const testWorkflow = await testDataFactory.createWorkflow({
        title: 'Mail Mismatch Test',
        share: {
          access: [
            {
              subjectId: 'correct@example.com',
              subjectType: 'mail',
              role: ACCESS_ROLES.reader,
            },
          ],
        },
      })

      const response = await rawRequest
        .get(`/api/v1/workflow/${testWorkflow.workflowId}`)
        .set('Authorization', `Bearer ${token}`)

      expect(response.status).toBe(401)
    })

    it('prevents access without mail claim when mail subject type required', async () => {
      const token = jwt.sign(
        {
          sub: 'external_user',
          roles: [ROLES.subscriber],
        },
        JWT_SECRET,
        {expiresIn: 86400},
      )

      const testWorkflow = await testDataFactory.createWorkflow({
        title: 'No Mail Claim Test',
        share: {
          access: [
            {
              subjectId: 'test@example.com',
              subjectType: 'mail',
              role: ACCESS_ROLES.reader,
            },
          ],
        },
      })

      const response = await rawRequest
        .get(`/api/v1/workflow/${testWorkflow.workflowId}`)
        .set('Authorization', `Bearer ${token}`)

      expect(response.status).toBe(401)
    })
  })

  describe('Invalid Role Assignment Prevention', () => {
    it('rejects access rule with invalid role', async () => {
      const adminWorkflow = await createAdminWorkflow('Invalid role test')

      const response = await administratorRequest.post(`/workflow/${adminWorkflow.workflowId}/share/access`).send([
        {
          subjectId: subscriberUserId,
          subjectType: 'user',
          role: 'super_admin',
        },
      ])

      expect(response.status).toBe(400)
    })

    it('rejects access rule with missing role', async () => {
      const adminWorkflow = await createAdminWorkflow('Missing role test')

      const response = await administratorRequest.post(`/workflow/${adminWorkflow.workflowId}/share/access`).send([
        {
          subjectId: subscriberUserId,
          subjectType: 'user',
        },
      ])

      expect(response.status).toBe(400)
    })

    it('rejects access rule with null role', async () => {
      const adminWorkflow = await createAdminWorkflow('Null role test')

      const response = await administratorRequest.post(`/workflow/${adminWorkflow.workflowId}/share/access`).send([
        {
          subjectId: subscriberUserId,
          subjectType: 'user',
          role: null,
        },
      ])

      expect(response.status).toBe(400)
    })

    it('rejects access rule with empty string role', async () => {
      const adminWorkflow = await createAdminWorkflow('Empty string role test')

      const response = await administratorRequest.post(`/workflow/${adminWorkflow.workflowId}/share/access`).send([
        {
          subjectId: subscriberUserId,
          subjectType: 'user',
          role: '',
        },
      ])

      expect(response.status).toBe(400)
    })

    it('rejects access rule with numeric role', async () => {
      const adminWorkflow = await createAdminWorkflow('Numeric role test')

      const response = await administratorRequest.post(`/workflow/${adminWorkflow.workflowId}/share/access`).send([
        {
          subjectId: subscriberUserId,
          subjectType: 'user',
          role: 123,
        },
      ])

      expect(response.status).toBe(400)
    })
  })

  describe('Workflow Deletion Access Control', () => {
    it('allows owner to delete workflow', async () => {
      const testWorkflow = await testDataFactory.createWorkflow({
        title: 'Owner Delete Test',
        userId: subscriberUserId,
      })

      const response = await subscriberRequest.delete(`/workflow/${testWorkflow.workflowId}`)

      expect(response.status).toBe(200)
    })

    it('allows access list owner to delete workflow', async () => {
      const testWorkflow = await testDataFactory.createWorkflow({
        title: 'Access Owner Delete Test',
        userId: administratorUserId,
        share: {
          access: [
            {
              subjectId: subscriberUserId,
              subjectType: 'user',
              role: ACCESS_ROLES.owner,
            },
          ],
        },
      })

      const response = await subscriberRequest.delete(`/workflow/${testWorkflow.workflowId}`)

      expect(response.status).toBe(200)
    })

    it('prevents deletion after ownership removed from access list', async () => {
      const testWorkflow = await testDataFactory.createWorkflow({
        title: 'Ownership Removal Test',
        userId: administratorUserId,
        share: {
          access: [
            {
              subjectId: subscriberUserId,
              subjectType: 'user',
              role: ACCESS_ROLES.owner,
            },
          ],
        },
      })

      await administratorRequest.post(`/workflow/${testWorkflow.workflowId}/share/access`).send([])

      const response = await subscriberRequest.delete(`/workflow/${testWorkflow.workflowId}`)

      expect(response.status).toBe(401)
    })
  })
})
