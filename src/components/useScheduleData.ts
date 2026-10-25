import { useCallback, useEffect, useState } from 'react'
import { DEFAULT_FAMILY_SUNDAY_WEEK, FAMILY_SUNDAY_SETTING, familySettingId, type FamilyWeeks } from '../data/schedule'
import { scheduleEditStore, scheduleStore, settingStore } from '../data/store'
import type { ScheduleEdit, ScheduleRow } from '../data/types'

// Everything needed to work out a month of the Sunday schedule: the default table (every year's rows), this
// month's edits, which week is Family Sunday, and the special Sundays (conferences, Easter...).
export function useScheduleData() {
  const [rows, setRows] = useState<ScheduleRow[]>([])
  const [edits, setEdits] = useState<ScheduleEdit[]>([])
  const [familyWeek, setFamilyWeek] = useState<FamilyWeeks>({ base: DEFAULT_FAMILY_SUNDAY_WEEK, byYear: {} })
  const [special, setSpecial] = useState<Record<string, string>>({})

  const reload = useCallback(async () => {
    setRows((await scheduleStore.list()).sort((a, b) => a.order - b.order))
    setEdits(await scheduleEditStore.list())
    const settings = await settingStore.list()
    const fam = settings.find((s) => s.id === FAMILY_SUNDAY_SETTING)
    const byYear: Record<number, number> = {}
    for (const s of settings) {
      if (s.id.startsWith(familySettingId(0).slice(0, -1))) byYear[Number(s.id.split('@')[1])] = Number(s.value)
    }
    setFamilyWeek({ base: fam ? Number(fam.value) : DEFAULT_FAMILY_SUNDAY_WEEK, byYear })
    setSpecial(Object.fromEntries(settings.filter((s) => s.id.startsWith('special.')).map((s) => [s.id, s.value])))
  }, [])
  useEffect(() => { reload() }, [reload])

  return { rows, edits, familyWeek, special, reload }
}
