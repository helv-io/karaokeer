export const Jobs: Job[] = []

export class Job {
  constructor(
    public id: string,
    public success = false,
    public status = 'Accepted',
    public requestedOn = new Date(Date.now()),
    public name?: string,
    public finishedOn?: Date
  ) {}

  sync = () => {
    Jobs.forEach((job, index) => {
      Jobs[index] = job.id === this.id ? this : job
    })
  }
}
