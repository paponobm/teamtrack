'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'

export async function login(formData: FormData) {
    const email = formData.get('email') as string
    const password = formData.get('password') as string

    const supabase = await createClient()

    const { data: { user }, error } = await supabase.auth.signInWithPassword({
        email,
        password,
    })

    if (error) {
        return { error: error.message }
    }

    // Block deactivated accounts at login (admin client bypasses RLS for a reliable read).
    if (user) {
        const admin = createAdminClient()
        const { data: emp } = await admin
            .from('employees')
            .select('is_active')
            .eq('user_id', user.id)
            .single()
        if (emp && emp.is_active === false) {
            await supabase.auth.signOut()
            return { error: 'Your account is deactivated, Please contact admin' }
        }
    }

    redirect('/dashboard')
}
