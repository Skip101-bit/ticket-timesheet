export type Activity = {
  id: string
  date: string
  title: string
  note: string
  startTime: string
  endTime: string
  userId: string
  userName: string
  colour: string
  createdAt: string
  updatedAt: string
}

export type NewActivityInput = {
  date: string
  title: string
  note?: string
  startTime?: string
  endTime?: string
  colour?: string
}
