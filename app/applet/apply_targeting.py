with open('pages/user/UserTasksSubmit.tsx', 'r') as f:
    content = f.read()

def replace_exact(old, new, count=1):
    global content
    if old not in content:
        raise Exception(f'Substring not found: {repr(old[:40])}...')
    content = content.replace(old, new, count)

# 1. Audience Type Selector
replace_exact(
    '''                                 {/* Audience Type Selector */}
                                 <div className="flex gap-4 py-2 border-b border-gray-100 dark:border-gray-800">''',
    '''                                 {/* Audience Type Selector */}
                                 {settings?.audienceTargeting?.selectedUsersEnabled !== false && (
                                 <div className="flex gap-4 py-2 border-b border-gray-100 dark:border-gray-800">'''
)

replace_exact(
    '''                                 </div>

                                 {/* Selected Users */}''',
    '''                                 </div>
                                 )}

                                 {/* Selected Users */}'''
)

# 2. Selected Users
replace_exact(
    '''                                 {/* Selected Users */}
                                 {targetingAudienceType === 'selected' && (''',
    '''                                 {/* Selected Users */}
                                 {settings?.audienceTargeting?.selectedUsersEnabled !== false && targetingAudienceType === 'selected' && ('''
)

# 3. Countries
replace_exact(
    '''                                 {/* A. Countries */}
                                 <div className="space-y-2">''',
    '''                                 {/* A. Countries */}
                                 {settings?.audienceTargeting?.countriesEnabled !== false && (
                                 <div className="space-y-2">'''
)

replace_exact(
    '''                                 </div>

                                 {/* B. Currencies */}''',
    '''                                 </div>
                                 )}

                                 {/* B. Currencies */}'''
)

# 4. Currencies
replace_exact(
    '''                                 {/* B. Currencies */}
                                 <div className="space-y-1.5">''',
    '''                                 {/* B. Currencies */}
                                 {settings?.audienceTargeting?.currenciesEnabled !== false && (
                                 <div className="space-y-1.5">'''
)

replace_exact(
    '''                                 </div>

                                 {/* C. Gender */}''',
    '''                                 </div>
                                 )}

                                 {/* C. Gender */}'''
)

# 5. Gender
replace_exact(
    '''                                 {/* C. Gender */}
                                 <div className="space-y-1.5">''',
    '''                                 {/* C. Gender */}
                                 {settings?.audienceTargeting?.genderEnabled !== false && (
                                 <div className="space-y-1.5">'''
)

replace_exact(
    '''                                 </div>

                                 {/* D & E. Age Range */}''',
    '''                                 </div>
                                 )}

                                 {/* D & E. Age Range */}'''
)

# 6. Age Range
replace_exact(
    '''                                 {/* D & E. Age Range */}
                                 <div className="space-y-1.5">''',
    '''                                 {/* D & E. Age Range */}
                                 {settings?.audienceTargeting?.ageEnabled !== false && (
                                 <div className="space-y-1.5">'''
)

replace_exact(
    '''                                     </div>
                                 </div>
                             </div>

                             {/* Advanced Audience Targeting Section (E1) */}''',
    '''                                     </div>
                                 </div>
                                 )}
                             </div>

                             {/* Advanced Audience Targeting Section (E1) */}'''
)

# 7. Advanced Audience Targeting Container & Rules
replace_exact(
    '''                             {/* Advanced Audience Targeting Section (E1) */}
                             <div className="p-4 md:p-5 rounded-xl bg-slate-900/40 border border-slate-700/60 space-y-4">''',
    '''                             {/* Advanced Audience Targeting Section (E1) */}
                             {(settings?.audienceTargeting?.accountStatusEnabled !== false || settings?.audienceTargeting?.advancedE1Enabled !== false) && (
                             <div className="p-4 md:p-5 rounded-xl bg-slate-900/40 border border-slate-700/60 space-y-4">'''
)

replace_exact(
    '''                             </div>

                             {/* Base Creation Fee Notice Banner''',
    '''                             </div>
                             )}

                             {/* Base Creation Fee Notice Banner'''
)

replace_exact(
    '''                                 {/* Account Status */}
                                 <div>''',
    '''                                 {/* Account Status */}
                                 {settings?.audienceTargeting?.accountStatusEnabled !== false && (
                                 <div>'''
)

replace_exact(
    '''                                 </select>
                                 </div>

                                 {/* Completion Rules */}''',
    '''                                 </select>
                                 </div>
                                 )}

                                 {/* Completion Rules */}'''
)

replace_exact(
    '''                                 {/* Completion Rules */}
                                 <div className="space-y-2">''',
    '''                                 {/* Completion Rules */}
                                 {settings?.audienceTargeting?.advancedE1Enabled !== false && (
                                 <div className="space-y-2">'''
)

replace_exact(
    '''                                 </div>
                                 </div>

                                 {/* Profile Attribute Rules */}''',
    '''                                 </div>
                                 </div>
                                 )}

                                 {/* Profile Attribute Rules */}'''
)

replace_exact(
    '''                                 {/* Profile Attribute Rules */}
                                 <div className="space-y-2">''',
    '''                                 {/* Profile Attribute Rules */}
                                 {settings?.audienceTargeting?.advancedE1Enabled !== false && (
                                 <div className="space-y-2">'''
)

replace_exact(
    '''                                 </div>
                                 </div>

                                 {/* Survey Answer Rules */}''',
    '''                                 </div>
                                 </div>
                                 )}

                                 {/* Survey Answer Rules */}'''
)

replace_exact(
    '''                                 {/* Survey Answer Rules */}
                                 <div className="space-y-2">''',
    '''                                 {/* Survey Answer Rules */}
                                 {settings?.audienceTargeting?.advancedE1Enabled !== false && (
                                 <div className="space-y-2">'''
)

replace_exact(
    '''                                 </div>
                                 </div>
                             </div>''',
    '''                                 </div>
                                 </div>
                                 )}
                             </div>'''
)

with open('pages/user/UserTasksSubmit.tsx', 'w') as f:
    f.write(content)

print('SUCCESS: All visibility switches applied successfully!')
