import { nextTick } from 'vue'

export function useAnnouncer() {
  const message = useState<string>('announcer', () => '')

  async function announce(text: string) {
    message.value = ''
    await nextTick()
    message.value = text
  }

  return { message, announce }
}
