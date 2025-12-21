import { z } from 'zod'

export const loginFormSchema = z.object({
  usernameOrEmail: z.string().nonempty('Username or email is required'),
  password: z.string().nonempty('Password is required'),
})

export type LoginFormValues = z.infer<typeof loginFormSchema>
