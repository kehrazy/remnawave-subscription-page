import {
    Alert,
    Anchor,
    Button,
    Collapse,
    Group,
    Select,
    Stack,
    Text,
    TextInput
} from '@mantine/core'
import { IconDownload } from '@tabler/icons-react'
import { useEffect, useState } from 'react'

import { useCurrentLang } from '@entities/app-config-store'
import { useSubscription } from '@entities/subscription-info-store'

type Device = { uuid: string; name: string }

export function NativeProfileSelection({ engine }: { engine: 'openvpn' | 'amneziawg' }) {
    const ru = useCurrentLang().startsWith('ru')
    const subscription = useSubscription()
    const profiles = subscription.connectionProfiles.filter((profile) => profile.engine === engine)
    const [route, setRoute] = useState(profiles[0]?.id ?? '')
    const selectedProfile = profiles.find((profile) => profile.id === route) ?? profiles[0]
    const [devices, setDevices] = useState<Device[]>([{ uuid: 'default', name: 'Default' }])
    const [device, setDevice] = useState('default')
    const [name, setName] = useState('')
    const [editingDevices, setEditingDevices] = useState(false)
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState(false)
    const deviceUrl = subscription.subscriptionUrl.replace(/\/$/, '') + '/amneziawg/devices'

    async function refreshDevices() {
        const response = await fetch(deviceUrl, { cache: 'no-store' })
        if (!response.ok) throw new Error('Device request failed')
        const data = (await response.json()) as { response: Device[] }
        setDevices(data.response)
    }

    useEffect(() => {
        if (engine === 'amneziawg' && subscription.user.isActive)
            void refreshDevices().catch(() => setError(true))
    }, [deviceUrl, engine, subscription.user.isActive])

    async function changeDevice(remove: boolean) {
        setBusy(true)
        setError(false)
        try {
            const response = await fetch(remove ? `${deviceUrl}/${device}` : deviceUrl, {
                method: remove ? 'DELETE' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: remove ? undefined : JSON.stringify({ name: name.trim() })
            })
            if (!response.ok) throw new Error('Device request failed')
            setDevice(
                remove ? 'default' : ((await response.json()) as { response: Device }).response.uuid
            )
            setName('')
            await refreshDevices()
        } catch {
            setError(true)
        } finally {
            setBusy(false)
        }
    }

    if (!selectedProfile || !subscription.user.isActive) return null
    return (
        <Stack gap="md">
            <Stack gap={4}>
                <Text fw={600}>{ru ? '1. Установите приложение' : '1. Install the app'}</Text>
                <Anchor
                    href={
                        engine === 'openvpn'
                            ? 'https://openvpn.net/connect/'
                            : 'https://docs.amnezia.org/documentation/instructions/use-amneziawg-app/'
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    {engine === 'openvpn' ? 'OpenVPN Connect' : 'AmneziaWG / AmneziaVPN (AWG 3.1)'}
                </Anchor>
            </Stack>
            <Stack gap="sm">
                <Text fw={600}>
                    {ru
                        ? '2. Выберите маршрут и скачайте профиль'
                        : '2. Choose a route and download its profile'}
                </Text>
                <Select
                    aria-label={ru ? 'Маршрут' : 'Route'}
                    value={selectedProfile.id}
                    allowDeselect={false}
                    data={profiles.map((profile) => ({ value: profile.id, label: profile.name }))}
                    onChange={(value) => setRoute(value ?? '')}
                />
                {engine === 'amneziawg' && (
                    <>
                        <Group align="end">
                            <Select
                                label={ru ? 'Это устройство' : 'This device'}
                                value={device}
                                allowDeselect={false}
                                data={devices.map((entry) => ({
                                    value: entry.uuid,
                                    label:
                                        entry.uuid === 'default'
                                            ? ru
                                                ? 'Основное устройство'
                                                : 'Default device'
                                            : entry.name
                                }))}
                                onChange={(value) => setDevice(value ?? 'default')}
                            />
                            <Button
                                variant="subtle"
                                size="compact-sm"
                                onClick={() => setEditingDevices(!editingDevices)}
                            >
                                {ru ? 'Устройства' : 'Devices'}
                            </Button>
                        </Group>
                        <Text c="dimmed" size="xs">
                            {ru
                                ? 'Для каждого устройства нужен отдельный профиль. Скачивайте его после выбора устройства.'
                                : 'Use a separate profile for each device. Select the device before downloading.'}
                        </Text>
                        <Collapse expanded={editingDevices}>
                            <Stack gap="sm">
                                <Group align="end">
                                    <TextInput
                                        label={ru ? 'Новое устройство' : 'New device'}
                                        maxLength={64}
                                        value={name}
                                        onChange={(event) => setName(event.currentTarget.value)}
                                    />
                                    <Button
                                        disabled={!name.trim() || devices.length >= 5}
                                        loading={busy}
                                        onClick={() => void changeDevice(false)}
                                    >
                                        {ru ? 'Добавить' : 'Add'}
                                    </Button>
                                </Group>
                                {device !== 'default' && (
                                    <Button
                                        color="red"
                                        variant="subtle"
                                        loading={busy}
                                        onClick={() => {
                                            if (
                                                window.confirm(
                                                    ru
                                                        ? 'Отозвать профили этого устройства?'
                                                        : 'Revoke this device’s profiles?'
                                                )
                                            )
                                                void changeDevice(true)
                                        }}
                                    >
                                        {ru
                                            ? 'Удалить выбранное устройство'
                                            : 'Remove selected device'}
                                    </Button>
                                )}
                            </Stack>
                        </Collapse>
                    </>
                )}
                {error && (
                    <Alert color="red">
                        {ru ? 'Не удалось обновить устройства.' : 'Could not update devices.'}
                        <Button
                            ml="sm"
                            variant="subtle"
                            onClick={() =>
                                void refreshDevices()
                                    .then(() => setError(false))
                                    .catch(() => setError(true))
                            }
                        >
                            {ru ? 'Повторить' : 'Retry'}
                        </Button>
                    </Alert>
                )}
                <Button
                    component="a"
                    download={`${selectedProfile.name}.${selectedProfile.format}`}
                    href={
                        selectedProfile.url +
                        (engine === 'amneziawg' ? `?device=${encodeURIComponent(device)}` : '')
                    }
                    leftSection={<IconDownload size={18} />}
                    variant="light"
                >
                    {ru ? 'Скачать профиль' : 'Download profile'} · .{selectedProfile.format}
                </Button>
            </Stack>
            <Stack gap={4}>
                <Text fw={600}>
                    {ru ? '3. Импортируйте файл и подключитесь' : '3. Import the file and connect'}
                </Text>
                <Text c="dimmed" size="sm">
                    {ru
                        ? 'Откройте скачанный файл в выбранном приложении. Аккаунт, срок действия и лимит трафика общие для всех способов подключения.'
                        : 'Open the downloaded file in the selected app. All connection methods share your account, expiry and traffic allowance.'}
                </Text>
            </Stack>
        </Stack>
    )
}
