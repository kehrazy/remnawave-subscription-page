import { Alert, Button, Group, Paper, Select, Stack, Text, TextInput, Title } from '@mantine/core'
import { IconDownload } from '@tabler/icons-react'
import { useEffect, useState } from 'react'
import { useSubscription } from '@entities/subscription-info-store'
import { useCurrentLang } from '@entities/app-config-store'

type Device = { uuid: string; name: string }
type Profile = { uuid: string; name: string; generation: string; url: string }

export function AmneziaWgWidget() {
    const lang = useCurrentLang()
    const ru = lang.startsWith('ru')
    const subscription = useSubscription() as ReturnType<typeof useSubscription> & { amneziaWgProfiles?: Profile[] }
    const profiles = subscription.amneziaWgProfiles ?? []
    const [devices, setDevices] = useState<Device[]>([])
    const [selected, setSelected] = useState('default')
    const [name, setName] = useState('')
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState(false)
    const deviceUrl = subscription.subscriptionUrl.replace(/\/$/, '') + '/amneziawg/devices'

    async function refreshDevices() {
        const result = await fetch(deviceUrl, { cache: 'no-store' })
        if (!result.ok) throw new Error('Device request failed')
        const data = await result.json() as { response: Device[] }
        setDevices(data.response)
    }

    useEffect(() => {
        if (profiles.length && subscription.user.isActive) void refreshDevices().catch(() => setError(true))
    }, [deviceUrl, profiles.length, subscription.user.isActive])

    async function changeDevice(remove: boolean) {
        setBusy(true)
        setError(false)
        try {
            const result = await fetch(remove ? deviceUrl + '/' + selected : deviceUrl, {
                method: remove ? 'DELETE' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: remove ? undefined : JSON.stringify({ name: name.trim() })
            })
            if (!result.ok) throw new Error('Device request failed')
            if (remove) setSelected('default')
            else setSelected((await result.json() as { response: Device }).response.uuid)
            setName('')
            await refreshDevices()
        } catch { setError(true) }
        finally { setBusy(false) }
    }

    if (!subscription.user.isActive || profiles.length === 0) return null
    return <Paper p="lg" radius="md" withBorder><Stack gap="md">
        <Title order={3}>AmneziaWG</Title>
        <Text c="dimmed" size="sm">{ru
            ? 'Импортируйте файл .conf в актуальный клиент AmneziaWG или AmneziaVPN. Для каждого устройства нужен отдельный профиль. Аккаунт и лимит трафика общие.'
            : 'Import the .conf file into a current AmneziaWG or AmneziaVPN client. Use a separate profile for each device. Your account and traffic allowance are shared.'}</Text>
        {error && <Alert color="red">{ru ? 'Не удалось обновить устройства. Попробуйте ещё раз.' : 'Could not update devices. Try again.'}</Alert>}
        <Group align="end">
            <Select label={ru ? 'Устройство' : 'Device'} value={selected} onChange={(value) => setSelected(value ?? 'default')}
                data={devices.map((device) => ({ value: device.uuid, label: device.uuid === 'default' ? (ru ? 'Основное устройство' : 'Default device') : device.name }))} />
            {selected !== 'default' && <Button color="red" loading={busy} variant="subtle" onClick={() => {
                if (window.confirm(ru ? 'Удалить устройство и отозвать его профили?' : 'Remove this device and revoke its profiles?')) void changeDevice(true)
            }}>{ru ? 'Удалить' : 'Remove'}</Button>}
        </Group>
        <Group align="end">
            <TextInput label={ru ? 'Добавить устройство' : 'Add device'} placeholder={ru ? 'Например: телефон' : 'For example: phone'} maxLength={64} value={name} onChange={(event) => setName(event.currentTarget.value)} />
            <Button disabled={!name.trim() || devices.length >= 5} loading={busy} onClick={() => void changeDevice(false)}>{ru ? 'Добавить' : 'Add'}</Button>
        </Group>
        {profiles.map((profile) => <Group justify="space-between" key={profile.uuid} wrap="wrap">
            <Text>{profile.name} · AWG {profile.generation}</Text>
            <Button component="a" download={`${profile.name}.conf`} href={`${profile.url}?device=${encodeURIComponent(selected)}`}
                leftSection={<IconDownload size={16} />} size="xs" variant="light">.conf</Button>
        </Group>)}
    </Stack></Paper>
}
