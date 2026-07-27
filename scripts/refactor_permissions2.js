const fs = require('fs')
const path = require('path')

const files = [
    'src/app/(dashboard)/ideas/page.tsx',
    'src/app/(dashboard)/members/page.tsx',
    'src/app/(dashboard)/dashboard/page.tsx',
    'src/app/(dashboard)/problems/page.tsx',
    'src/app/(dashboard)/noticeboard/page.tsx',
    'src/app/(dashboard)/work-log/page.tsx',
    'src/app/(dashboard)/content/page.tsx',
    'src/app/(dashboard)/expenses/page.tsx',
    'src/app/(dashboard)/courier/page.tsx',
    'src/app/(dashboard)/tasks/page.tsx',
    'src/app/(dashboard)/requisitions/page.tsx',
    'src/app/(dashboard)/attendance/page.tsx'
]

for (const f of files) {
    const fullPath = path.join(process.cwd(), f)
    if (!fs.existsSync(fullPath)) continue
    
    let content = fs.readFileSync(fullPath, 'utf8')
    if (!content.includes("fetch('/api/permissions/me')")) continue

    // 1. Add import if not present
    if (!content.includes("import { usePermissions }")) {
        // Find the last import
        const importRegex = /^import .* from .*$/gm
        let lastMatch = null
        let match
        while ((match = importRegex.exec(content)) !== null) {
            lastMatch = match
        }
        if (lastMatch) {
            const index = lastMatch.index + lastMatch[0].length
            content = content.slice(0, index) + "\nimport { usePermissions } from '@/lib/PermissionsContext'" + content.slice(index)
        }
    }

    // 2. Insert hook call right after the component declaration
    const exportRegex = /export default function [a-zA-Z]+\(\) \{/g
    const match = exportRegex.exec(content)
    if (match && !content.includes('const { data: perms } = usePermissions()')) {
        const index = match.index + match[0].length
        content = content.slice(0, index) + "\n    const { data: perms } = usePermissions()" + content.slice(index)
    }

    // 3. Replace the fetch logic
    // We look for fetch('/api/permissions/me').then(r => r.json()).then(d => { ... }).catch(() => { ... })
    // It could be spread across multiple lines.
    const fetchRegex = /fetch\('\/api\/permissions\/me'\)\.then\(r => r\.json\(\)\)\.then\([d\w] => \{([\s\S]*?)\}\)\.catch\(\(\) => \{.*\}\)/
    const fetchMatch = fetchRegex.exec(content)
    
    if (fetchMatch) {
        let insideLogic = fetchMatch[1]
        // replace `d.` with `perms.`
        insideLogic = insideLogic.replace(/\bd\./g, 'perms.')
        
        const replacement = `
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => {${insideLogic}}, [perms])`
        
        content = content.replace(fetchMatch[0], replacement.trim())
    }

    fs.writeFileSync(fullPath, content)
    console.log('Updated ' + f)
}
